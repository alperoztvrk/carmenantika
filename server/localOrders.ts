import fs from "node:fs";
import path from "node:path";
import type { InsertOrder, InsertOrderItem, Order, OrderItem } from "../drizzle/schema";
import { patchLocalProduct } from "./localCatalog";

const HOLD_MS = 30 * 60 * 1000;
const persistPath = path.resolve(".data/carmen-orders.json");
const persistEnabled = process.env.NODE_ENV !== "test";

export type StoredOrder = Order & { items: OrderItem[] };

const memoryOrders: StoredOrder[] = [];
const tokenIndex = new Map<string, string>();
let nextOrderId = 1;
let nextItemId = 1;
let loaded = false;

function withItems(order: StoredOrder) {
  return { ...order, items: order.items.map((item) => ({ ...item })) };
}

function persist() {
  if (!persistEnabled) return;
  try {
    fs.mkdirSync(path.dirname(persistPath), { recursive: true });
    fs.writeFileSync(persistPath, JSON.stringify({
      nextOrderId,
      nextItemId,
      tokens: Object.fromEntries(tokenIndex),
      orders: memoryOrders,
    }));
  } catch (error) {
    console.error("[orders] persist failed", error instanceof Error ? error.message : error);
  }
}

function restore() {
  if (!persistEnabled || loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(persistPath)) return;
    const saved = JSON.parse(fs.readFileSync(persistPath, "utf8")) as {
      nextOrderId?: number;
      nextItemId?: number;
      tokens?: Record<string, string>;
      orders?: Array<StoredOrder & { createdAt: string; updatedAt: string }>;
    };
    nextOrderId = saved.nextOrderId ?? 1;
    nextItemId = saved.nextItemId ?? 1;
    tokenIndex.clear();
    for (const [token, orderNumber] of Object.entries(saved.tokens ?? {})) tokenIndex.set(token, orderNumber);
    memoryOrders.splice(0, memoryOrders.length, ...(saved.orders ?? []).map((order) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
    })));
    for (const order of memoryOrders) {
      if (order.stripeCheckoutSessionId) tokenIndex.set(order.stripeCheckoutSessionId, order.orderNumber);
      if (order.status === "pending" || order.status === "paid") {
        for (const item of order.items) patchLocalProduct(item.productId, { isAvailable: 0 });
      }
    }
  } catch (error) {
    console.error("[orders] restore failed", error instanceof Error ? error.message : error);
  }
}

restore();

export function rememberLocalCheckoutToken(token: string, orderNumber: string) {
  if (!token || !orderNumber) return;
  tokenIndex.set(token, orderNumber);
  persist();
}

export function releaseStaleLocalOrders(now = Date.now()) {
  restore();
  for (const order of memoryOrders) {
    if (order.status !== "pending") continue;
    if (now - order.createdAt.getTime() < HOLD_MS) continue;
    order.status = "cancelled";
    order.updatedAt = new Date(now);
    for (const item of order.items) patchLocalProduct(item.productId, { isAvailable: 1 });
  }
  persist();
}

export function saveLocalOrder(input: InsertOrder, items: InsertOrderItem[]) {
  restore();
  const now = new Date();
  const id = nextOrderId++;
  const order: StoredOrder = {
    id,
    orderNumber: input.orderNumber,
    userId: input.userId ?? null,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone ?? "",
    shippingAddress: input.shippingAddress ?? null,
    totalCents: input.totalCents,
    currency: input.currency ?? "try",
    status: input.status ?? "pending",
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    createdAt: now,
    updatedAt: now,
    items: items.map((item) => ({
      id: nextItemId++,
      orderId: id,
      productId: item.productId,
      productName: item.productName,
      priceCents: item.priceCents,
      quantity: item.quantity ?? 1,
      imageUrl: item.imageUrl,
    })),
  };
  if (order.stripeCheckoutSessionId) tokenIndex.set(order.stripeCheckoutSessionId, order.orderNumber);
  memoryOrders.unshift(order);
  persist();
  return withItems(order);
}

export function deleteLocalOrder(id: number) {
  restore();
  const index = memoryOrders.findIndex((entry) => entry.id === id);
  if (index < 0) return undefined;
  const [removed] = memoryOrders.splice(index, 1);
  const staleTokens: string[] = [];
  tokenIndex.forEach((orderNumber, token) => {
    if (orderNumber === removed.orderNumber || token === removed.stripeCheckoutSessionId) staleTokens.push(token);
  });
  staleTokens.forEach((token) => tokenIndex.delete(token));
  persist();
  return withItems(removed);
}

export function patchLocalOrder(id: number, input: Partial<InsertOrder>) {
  restore();
  const order = memoryOrders.find((entry) => entry.id === id);
  if (!order) return undefined;
  Object.assign(order, input, { updatedAt: new Date() });
  if (order.stripeCheckoutSessionId) tokenIndex.set(order.stripeCheckoutSessionId, order.orderNumber);
  persist();
  return withItems(order);
}

export function findLocalOrder(id: number) {
  restore();
  const order = memoryOrders.find((entry) => entry.id === id);
  return order ? withItems(order) : undefined;
}

export function findLocalOrderByNumber(orderNumber: string) {
  restore();
  const order = memoryOrders.find((entry) => entry.orderNumber === orderNumber);
  return order ? withItems(order) : undefined;
}

export function findLocalOrderBySession(sessionId: string) {
  restore();
  const orderNumber = tokenIndex.get(sessionId);
  const order = memoryOrders.find((entry) => entry.stripeCheckoutSessionId === sessionId || entry.orderNumber === orderNumber);
  return order ? withItems(order) : undefined;
}

export function findLatestPendingLocalOrder() {
  restore();
  const order = memoryOrders.find((entry) => entry.status === "pending");
  return order ? withItems(order) : undefined;
}

export function readLocalOrders(userId?: number) {
  restore();
  releaseStaleLocalOrders();
  return memoryOrders
    .filter((order) => userId === undefined || order.userId === userId)
    .map((order) => withItems(order));
}

export function markLocalOrderPaid(orderId: number, paymentIntentId: string | null) {
  restore();
  const order = memoryOrders.find((entry) => entry.id === orderId);
  if (!order) return undefined;
  order.status = "paid";
  order.stripePaymentIntentId = paymentIntentId;
  order.updatedAt = new Date();
  for (const item of order.items) patchLocalProduct(item.productId, { isAvailable: 0 });
  persist();
  return withItems(order);
}
