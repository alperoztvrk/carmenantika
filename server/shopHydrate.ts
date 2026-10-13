import { exportLocalProducts, importLocalProducts } from "./localCatalog";
import { exportLocalOrders, importLocalOrders } from "./localOrders";
import { exportLocalReviews, importLocalReviews } from "./localReviews";
import {
  bindShopBackup,
  closeShopBackups,
  enqueueShopBackup,
  flushShopBackup,
  loadShopBackup,
  openShopBackups,
  type ShopSnapshot,
} from "./shopRemote";

function takeSnapshot(): ShopSnapshot {
  const reviews = exportLocalReviews();
  const orders = exportLocalOrders();
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    products: exportLocalProducts(),
    reviews: reviews.reviews,
    nextReviewId: reviews.nextId,
    orders: orders.orders,
    nextOrderId: orders.nextOrderId,
    nextItemId: orders.nextItemId,
    tokens: orders.tokens,
  };
}

function applySnapshot(snapshot: ShopSnapshot) {
  importLocalProducts(snapshot.products as Parameters<typeof importLocalProducts>[0], false);
  importLocalReviews({ nextId: snapshot.nextReviewId, reviews: snapshot.reviews as Parameters<typeof importLocalReviews>[0]["reviews"] }, false);
  importLocalOrders({
    nextOrderId: snapshot.nextOrderId,
    nextItemId: snapshot.nextItemId,
    tokens: snapshot.tokens,
    orders: snapshot.orders as Parameters<typeof importLocalOrders>[0]["orders"],
  }, false);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function mergeById(remote: unknown[] = [], local: unknown[] = []) {
  const map = new Map<string, unknown>();
  for (const item of [...remote, ...local]) {
    const record = asRecord(item);
    if (!record) continue;
    const id = record.id;
    const slug = record.slug;
    const key = typeof id === "number" ? `id:${id}` : typeof slug === "string" && slug ? `slug:${slug}` : `row:${map.size}`;
    map.set(key, item);
  }
  return Array.from(map.values());
}

export function mergeSnapshots(remote: ShopSnapshot | null, local: ShopSnapshot): ShopSnapshot {
  if (!remote) return local;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    products: mergeById(remote.products, local.products),
    reviews: mergeById(remote.reviews, local.reviews),
    orders: mergeById(remote.orders, local.orders),
    nextReviewId: Math.max(remote.nextReviewId ?? 1, local.nextReviewId ?? 1),
    nextOrderId: Math.max(remote.nextOrderId ?? 1, local.nextOrderId ?? 1),
    nextItemId: Math.max(remote.nextItemId ?? 1, local.nextItemId ?? 1),
    tokens: { ...(remote.tokens ?? {}), ...(local.tokens ?? {}) },
  };
}

function snapshotCount(snapshot: ShopSnapshot | null) {
  if (!snapshot) return 0;
  return (snapshot.products?.length ?? 0) + (snapshot.reviews?.length ?? 0) + (snapshot.orders?.length ?? 0);
}

export async function hydrateShop() {
  closeShopBackups();
  bindShopBackup(takeSnapshot);
  try {
    const local = takeSnapshot();
    const remote = await loadShopBackup();
    const merged = mergeSnapshots(remote, local);
    if (snapshotCount(merged) > 0) applySnapshot(merged);
    const grew = snapshotCount(merged) > snapshotCount(remote);
    if (!remote && snapshotCount(local) > 0) {
      openShopBackups();
      enqueueShopBackup();
      await flushShopBackup();
      console.log(`[shop] yerel katalog yedeğe alındı · ${local.products.length} ürün`);
      return;
    }
    if (remote && grew) {
      openShopBackups();
      enqueueShopBackup();
      await flushShopBackup();
      console.log(`[shop] yedek birleştirildi · ${merged.products.length} ürün · ${merged.reviews.length} yorum · ${merged.orders.length} sipariş`);
      return;
    }
    if (remote) {
      console.log(`[shop] yedekten yüklendi · ${remote.products.length} ürün · ${remote.reviews.length} yorum · ${remote.orders.length} sipariş`);
      return;
    }
    console.log("[shop] katalog boş. Eklediğin parçalar yedekte durur.");
  } finally {
    openShopBackups();
  }
}
