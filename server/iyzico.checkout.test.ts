import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { patchLocalProduct } from "./localCatalog";
import { appRouter } from "./routers";
import { iyzicoConfig } from "./iyzico";
import { completeIyzicoCheckout } from "./iyzicoCallback";

const savedEnv = {
  key: process.env.IYZICO_API_KEY,
  secret: process.env.IYZICO_SECRET_KEY,
  base: process.env.IYZICO_BASE_URL,
};
const originalFetch = globalThis.fetch;

function restoreEnv() {
  if (savedEnv.key === undefined) delete process.env.IYZICO_API_KEY;
  else process.env.IYZICO_API_KEY = savedEnv.key;
  if (savedEnv.secret === undefined) delete process.env.IYZICO_SECRET_KEY;
  else process.env.IYZICO_SECRET_KEY = savedEnv.secret;
  if (savedEnv.base === undefined) delete process.env.IYZICO_BASE_URL;
  else process.env.IYZICO_BASE_URL = savedEnv.base;
}

function caller() {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "http",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

const checkoutInput = {
  customerName: "Ayşe Yılmaz",
  customerPhone: "0532 123 45 67",
  shippingAddress: "Muratpaşa, Antalya, test adres",
  productIds: [9001],
};

afterEach(() => {
  restoreEnv();
  globalThis.fetch = originalFetch;
  patchLocalProduct(9001, { isAvailable: 1, priceCents: 245000 });
  patchLocalProduct(9002, { isAvailable: 1 });
});

describe("iyzico checkout", () => {
  it("reads a quoted sandbox key and sends it to the sandbox api", () => {
    process.env.IYZICO_API_KEY = '"sandbox-key"';
    process.env.IYZICO_SECRET_KEY = "'sandbox-secret'";
    process.env.IYZICO_BASE_URL = "https://api.iyzipay.com";
    expect(iyzicoConfig()).toMatchObject({ apiKey: "sandbox-key", secretKey: "sandbox-secret", baseUrl: "https://sandbox-api.iyzipay.com" });
  });

  it("refuses checkout when the iyzico keys are missing", async () => {
    delete process.env.IYZICO_API_KEY;
    delete process.env.IYZICO_SECRET_KEY;
    await expect(caller().order.createCheckout(checkoutInput)).rejects.toThrow(/IYZICO_API_KEY/);
    const present = await caller().product.present({ ids: [9001] });
    expect(present[0]?.isAvailable).toBe(1);
  });

  it("opens a TRY payment page and marks the order paid when iyzico confirms it", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    process.env.IYZICO_BASE_URL = "https://sandbox-api.iyzipay.com";
    let orderNumber = "";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/payment/iyzipos/checkoutform/auth/ecom/detail")) {
        return Response.json({
          status: "success",
          paymentStatus: "SUCCESS",
          paymentId: "pay_1",
          conversationId: orderNumber,
          basketId: orderNumber,
        });
      }
      const payload = String(init?.body ?? "");
      const headers = new Headers(init?.headers);
      const randomKey = headers.get("x-iyzi-rnd") ?? "";
      const authorization = headers.get("authorization") ?? "";
      const signature = crypto.createHmac("sha256", "sandbox-secret").update(`${randomKey}/payment/iyzipos/checkoutform/initialize/auth/ecom${payload}`).digest("hex");
      const decoded = Buffer.from(authorization.replace(/^IYZWSv2 /, ""), "base64").toString("utf8");
      expect(decoded).toBe(`apiKey:sandbox-key&randomKey:${randomKey}&signature:${signature}`);
      const body = JSON.parse(payload) as {
        currency: string;
        price: string;
        paidPrice: string;
        callbackUrl: string;
        buyer: { gsmNumber: string; email: string; identityNumber: string; ip: string };
        basketItems: { price: string }[];
      };
      expect(body.currency).toBe("TRY");
      expect(body.price).toBe("2450.00");
      expect(body.paidPrice).toBe(body.price);
      expect(body.basketItems.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)).toBe(body.price);
      expect(body.buyer.gsmNumber).toBe("+905321234567");
      expect(body.buyer.email).toBe("musteri.5321234567@siparis.carmenantika.com");
      expect(body.buyer.identityNumber).toBe("11111111111");
      expect(body.buyer.ip).toBe("85.34.78.112");
      expect(body.callbackUrl).toBe("http://localhost:3000/api/iyzico/callback");
      return Response.json({ status: "success", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_test", token: "tok_test" });
    };

    const started = await caller().order.createCheckout(checkoutInput);
    orderNumber = started.orderNumber;
    expect(started.url).toContain("sandbox-cpp.iyzipay.com");
    const pending = await caller().order.byNumber({ orderNumber });
    expect(pending?.status).toBe("pending");
    expect(pending?.customerPhone).toBe("0532 123 45 67");

    const destination = await completeIyzicoCheckout("tok_test");
    expect(destination).toBe(`/siparis-basarili?order=${encodeURIComponent(orderNumber)}`);
    const paid = await caller().order.byNumber({ orderNumber });
    expect(paid?.status).toBe("paid");
    const present = await caller().product.present({ ids: [9001] });
    expect(present[0]?.isAvailable).toBe(0);
  });

  it("cancels the pending order when iyzico reports a failed payment", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    let orderNumber = "";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/detail")) {
        return Response.json({ status: "success", paymentStatus: "FAILURE", conversationId: orderNumber, basketId: orderNumber });
      }
      return Response.json({ status: "success", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_fail", token: "tok_fail" });
    };
    const started = await caller().order.createCheckout({ ...checkoutInput, productIds: [9002] });
    orderNumber = started.orderNumber;
    const destination = await completeIyzicoCheckout("tok_fail", orderNumber);
    expect(destination).toContain("/sepet?iptal=");
    const order = await caller().order.byNumber({ orderNumber });
    expect(order?.status).toBe("cancelled");
    const present = await caller().product.present({ ids: [9002] });
    expect(present[0]?.isAvailable).toBe(1);
  });
});
