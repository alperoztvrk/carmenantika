import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { GUEST_ORDERS_COOKIE } from "../shared/const";
import { phonesMatch } from "./guestOrders";
import { patchLocalProduct } from "./localCatalog";
import { saveLocalOrder } from "./localOrders";

const saved = {
  key: process.env.IYZICO_API_KEY,
  secret: process.env.IYZICO_SECRET_KEY,
};

function restoreEnv() {
  if (saved.key === undefined) delete process.env.IYZICO_API_KEY;
  else process.env.IYZICO_API_KEY = saved.key;
  if (saved.secret === undefined) delete process.env.IYZICO_SECRET_KEY;
  else process.env.IYZICO_SECRET_KEY = saved.secret;
}

function caller(cookie = "") {
  const cookies: Array<{ name: string; value: string }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "http",
      hostname: "localhost",
      headers: { host: "localhost:3000", cookie },
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string) => {
        cookies.push({ name, value });
      },
    } as TrpcContext["res"],
  };
  return { api: appRouter.createCaller(ctx), cookies };
}

describe("guest orders", () => {
  it("matches phones by the last 10 digits", () => {
    expect(phonesMatch("0532 123 45 67", "+90 532 123 45 67")).toBe(true);
    expect(phonesMatch("0532 123 45 67", "0532 000 00 00")).toBe(false);
  });

  it("lets a guest find only their own order with number plus phone", async () => {
    restoreEnv();
    delete process.env.IYZICO_API_KEY;
    delete process.env.IYZICO_SECRET_KEY;
    const order = saveLocalOrder({
      orderNumber: "CA-GUEST-TEST",
      customerName: "Ayşe Yılmaz",
      customerEmail: "",
      customerPhone: "0532 123 45 67",
      shippingAddress: "Muratpaşa test",
      totalCents: 1000,
      currency: "try",
      status: "paid",
    }, [{
      orderId: 0,
      productId: 9005,
      productName: "Cam Gölgeler",
      priceCents: 1000,
      quantity: 1,
      imageUrl: "/photos/frames.jpg",
    }]);
    patchLocalProduct(9005, { isAvailable: 1 });

    const empty = caller();
    expect(await empty.api.order.mine()).toEqual([]);
    await expect(empty.api.order.lookup({ orderNumber: order.orderNumber, customerPhone: "05320000000" })).rejects.toThrow(/Sipariş bulunamadı/);

    const found = caller();
    const result = await found.api.order.lookup({ orderNumber: order.orderNumber, customerPhone: "5321234567" });
    expect(result.orderNumber).toBe(order.orderNumber);
    expect(found.cookies.some((cookie) => cookie.name === GUEST_ORDERS_COOKIE)).toBe(true);

    const stolen = caller();
    await expect(stolen.api.order.cancelCheckout({ orderNumber: order.orderNumber })).rejects.toThrow(/Sipariş bulunamadı/);
  });
});
