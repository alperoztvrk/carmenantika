import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertOrder,
  InsertOrderItem,
  InsertProduct,
  InsertUser,
  orderItems,
  orders,
  products,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { findLocalProduct, findLocalProductById, patchLocalProduct, readLocalProducts, removeLocalProduct, saveLocalProduct } from "./localCatalog";
import { findLocalOrder, findLocalOrderByNumber, markLocalOrderPaid, patchLocalOrder, readLocalOrders, releaseStaleLocalOrders, saveLocalOrder } from "./localOrders";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProducts(includeUnavailable = false) {
  const db = await getDb();
  if (!db) {
    releaseStaleLocalOrders();
    return readLocalProducts(includeUnavailable);
  }
  const query = db.select().from(products).orderBy(desc(products.createdAt));
  if (includeUnavailable) return query;
  return db.select().from(products).where(eq(products.isAvailable, 1)).orderBy(desc(products.createdAt));
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return findLocalProduct(slug);
  const result = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return result[0];
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return findLocalProductById(id);
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductsByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}

export async function createProduct(input: InsertProduct) {
  const db = await getDb();
  if (!db) return saveLocalProduct(input);
  const result = await db.insert(products).values(input);
  const id = Number((result as unknown as { insertId: number }).insertId);
  return getProductById(id);
}

export async function updateProduct(id: number, input: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return patchLocalProduct(id, input);
  await db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id));
  return getProductById(id);
}

export async function archiveProduct(id: number) {
  return updateProduct(id, { isAvailable: 0 });
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) return removeLocalProduct(id);
  await db.delete(products).where(eq(products.id, id));
  return { id };
}

export async function updateProductsAvailability(ids: number[], isAvailable: number) {
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) {
    ids.forEach((id) => patchLocalProduct(id, { isAvailable }));
    return;
  }
  await db.update(products).set({ isAvailable, updatedAt: new Date() }).where(inArray(products.id, ids));
}

async function withOrderItems<T extends { id: number }>(rows: T[]) {
  const db = await getDb();
  if (!db || rows.length === 0) return rows.map((row) => ({ ...row, items: [] as Array<typeof orderItems.$inferSelect> }));
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((row) => row.id)));
  return rows.map((row) => ({ ...row, items: items.filter((item) => item.orderId === row.id) }));
}

export async function createOrder(input: InsertOrder, items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) return saveLocalOrder(input, items);
  const result = await db.insert(orders).values(input);
  const orderId = Number((result as unknown as { insertId: number }).insertId);
  if (items.length > 0) {
    await db.insert(orderItems).values(items.map((item) => ({ ...item, orderId })));
  }
  return getOrderById(orderId);
}

export async function updateOrder(id: number, input: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return patchLocalOrder(id, input);
  await db.update(orders).set({ ...input, updatedAt: new Date() }).where(eq(orders.id, id));
  return getOrderById(id);
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return findLocalOrder(id);
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!result[0]) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...result[0], items };
}

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return findLocalOrderByNumber(orderNumber);
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!result[0]) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, result[0].id));
  return { ...result[0], items };
}

export async function markOrderPaid(orderId: number, paymentIntentId: string | null) {
  const db = await getDb();
  if (!db) return markLocalOrderPaid(orderId, paymentIntentId);
  const order = await getOrderById(orderId);
  if (!order) return undefined;
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: paymentIntentId, updatedAt: new Date() }).where(eq(orders.id, orderId));
  if (order.items.length > 0) {
    await db.update(products).set({ isAvailable: 0, updatedAt: new Date() }).where(inArray(products.id, order.items.map((item) => item.productId)));
  }
  return getOrderById(orderId);
}

export async function listOrdersForUser(userId: number) {
  const db = await getDb();
  if (!db) return readLocalOrders(userId);
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  return withOrderItems(rows);
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return readLocalOrders();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return withOrderItems(rows);
}

export function makeOrderNumber() {
  return `CA-${Date.now().toString(36).toUpperCase()}`;
}
