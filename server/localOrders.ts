import type { InsertOrder, InsertOrderItem, Order, OrderItem } from "../drizzle/schema";
import { patchLocalProduct } from "./localCatalog";

const HOLD_MS = 30 * 60 * 1000;

export type StoredOrder = Order & { items: OrderItem[] };

const memoryOrders: StoredOrder[] = [];
let nextOrderId = 1;
let nextItemId = 1;

function withItems(order: StoredOrder) {
  return { ...order, items: order.items.map((item) => ({ ...item })) };
}

export function releaseStaleLocalOrders(now = Date.now()) {
  for (const order of memoryOrders) {
    if (order.status !== "pending") continue;
    if (now - order.createdAt.getTime() < HOLD_MS) continue;
    order.status = "cancelled";
    order.updatedAt = new Date(now);
    for (const item of order.items) patchLocalProduct(item.productId, { isAvailable: 1 });
  }
}

export function saveLocalOrder(input: InsertOrder, items: InsertOrderItem[]) {
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
  memoryOrders.unshift(order);
  return withItems(order);
}

export function patchLocalOrder(id: number, input: Partial<InsertOrder>) {
  const order = memoryOrders.find((entry) => entry.id === id);
  if (!order) return undefined;
  Object.assign(order, input, { updatedAt: new Date() });
  return withItems(order);
}

export function findLocalOrder(id: number) {
  const order = memoryOrders.find((entry) => entry.id === id);
  return order ? withItems(order) : undefined;
}

export function findLocalOrderByNumber(orderNumber: string) {
  const order = memoryOrders.find((entry) => entry.orderNumber === orderNumber);
  return order ? withItems(order) : undefined;
}

export function findLocalOrderBySession(sessionId: string) {
  const order = memoryOrders.find((entry) => entry.stripeCheckoutSessionId === sessionId);
  return order ? withItems(order) : undefined;
}

export function readLocalOrders(userId?: number) {
  releaseStaleLocalOrders();
  return memoryOrders
    .filter((order) => userId === undefined || order.userId === userId)
    .map((order) => withItems(order));
}

export function markLocalOrderPaid(orderId: number, paymentIntentId: string | null) {
  const order = memoryOrders.find((entry) => entry.id === orderId);
  if (!order) return undefined;
  order.status = "paid";
  order.stripePaymentIntentId = paymentIntentId;
  order.updatedAt = new Date();
  for (const item of order.items) patchLocalProduct(item.productId, { isAvailable: 0 });
  return withItems(order);
}
