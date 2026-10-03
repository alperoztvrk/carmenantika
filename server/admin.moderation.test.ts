import { afterEach, describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getProductById } from "./db";
import { patchLocalProduct, saveLocalProduct } from "./localCatalog";
import { saveLocalOrder } from "./localOrders";
import { resetReviewsForTests } from "./localReviews";

const adminUser: User = {
  id: 1,
  openId: "local-admin",
  name: "Carmen",
  email: null,
  loginMethod: "local",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function caller(user: User | null = null) {
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "http",
      headers: { host: "localhost:3000" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

afterEach(() => {
  resetReviewsForTests();
});

describe("admin moderation", () => {
  it("lets an admin remove one review while the others stay on the public list", async () => {
    const shop = caller();
    const first = await shop.review.create({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      rating: 5,
      body: "Parça evimde çok güzel duruyor, teslimat da özenliydi.",
    });
    const second = await shop.review.create({
      firstName: "Kemal",
      lastName: "Demir",
      rating: 4,
      body: "Radyo çalışıyor, paket de sapasağlam geldi.",
    });

    const guest = caller();
    await expect(guest.review.adminDelete({ id: first.id })).rejects.toThrow(/permission/);

    const admin = caller(adminUser);
    expect((await admin.review.adminList()).map((review) => review.id)).toEqual([second.id, first.id]);
    await admin.review.adminDelete({ id: first.id });
    const left = await shop.review.list();
    expect(left.map((review) => review.id)).toEqual([second.id]);
    expect(left[0]?.body).toMatch(/Radyo/);
  });

  it("removes one order, keeps the other, and puts the freed piece back on sale", async () => {
    const product = saveLocalProduct({
      slug: `silinecek-${Date.now()}`,
      name: "Silinecek Parça",
      category: "Objeler",
      era: "1960",
      priceCents: 150000,
      shortDescription: "Tek parça deneme.",
      description: "Yönetim silme denemesi için.",
      condition: "İyi.",
      imageUrl: "/photos/frames.jpg",
      currency: "try",
      isAvailable: 0,
    });
    const keptProduct = saveLocalProduct({
      slug: `kalacak-${Date.now()}`,
      name: "Kalacak Parça",
      category: "Objeler",
      era: "1970",
      priceCents: 80000,
      shortDescription: "Bu sipariş durur.",
      description: "Silinmeyen sipariş.",
      condition: "İyi.",
      imageUrl: "/photos/radio.jpg",
      currency: "try",
      isAvailable: 0,
    });
    patchLocalProduct(product.id, { isAvailable: 0 });
    const dropped = saveLocalOrder({
      orderNumber: `CA-DROP-${product.id}`,
      customerName: "Ayşe Yılmaz",
      customerEmail: "",
      customerPhone: "0552 442 42 28",
      shippingAddress: "Muratpaşa test adresi",
      totalCents: 150000,
      currency: "try",
      status: "paid",
    }, [{
      orderId: 0,
      productId: product.id,
      productName: product.name,
      priceCents: 150000,
      quantity: 1,
      imageUrl: product.imageUrl,
    }]);
    const kept = saveLocalOrder({
      orderNumber: `CA-KEEP-${keptProduct.id}`,
      customerName: "Kemal Demir",
      customerEmail: "",
      customerPhone: "0532 000 00 01",
      shippingAddress: "Kepez test adresi",
      totalCents: 80000,
      currency: "try",
      status: "paid",
    }, [{
      orderId: 0,
      productId: keptProduct.id,
      productName: keptProduct.name,
      priceCents: 80000,
      quantity: 1,
      imageUrl: keptProduct.imageUrl,
    }]);

    const guest = caller();
    await expect(guest.order.adminDelete({ id: dropped.id })).rejects.toThrow(/permission/);

    const admin = caller(adminUser);
    await admin.order.adminDelete({ id: dropped.id });
    const left = await admin.order.adminList();
    expect(left.some((order) => order.id === dropped.id)).toBe(false);
    expect(left.some((order) => order.id === kept.id)).toBe(true);
    expect((await getProductById(product.id))?.isAvailable).toBe(1);
    expect((await getProductById(keptProduct.id))?.isAvailable).toBe(0);
    await expect(guest.order.lookup({ orderNumber: dropped.orderNumber, customerPhone: "05524424228" })).rejects.toThrow(/Sipariş bulunamadı/);
  });
});
