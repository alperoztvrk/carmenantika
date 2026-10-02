import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { patchLocalProduct } from "./localCatalog";
import { appRouter } from "./routers";
import { hostedCheckoutUrl, iyzicoConfig, isValidTckn, publicOrigin } from "./iyzico";
import { completeIyzicoCheckout } from "./iyzicoCallback";

const savedEnv = {
  key: process.env.IYZICO_API_KEY,
  secret: process.env.IYZICO_SECRET_KEY,
  base: process.env.IYZICO_BASE_URL,
  site: process.env.SITE_URL,
};
const originalFetch = globalThis.fetch;

function restoreEnv() {
  if (savedEnv.key === undefined) delete process.env.IYZICO_API_KEY;
  else process.env.IYZICO_API_KEY = savedEnv.key;
  if (savedEnv.secret === undefined) delete process.env.IYZICO_SECRET_KEY;
  else process.env.IYZICO_SECRET_KEY = savedEnv.secret;
  if (savedEnv.base === undefined) delete process.env.IYZICO_BASE_URL;
  else process.env.IYZICO_BASE_URL = savedEnv.base;
  if (savedEnv.site === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = savedEnv.site;
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
  patchLocalProduct(9003, { isAvailable: 1 });
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
        enabledInstallments?: number[];
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
      expect(body.enabledInstallments).toEqual([1]);
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

  it("opens the hosted page from the token when iyzico omits paymentPageUrl", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    globalThis.fetch = async () => Response.json({ status: "success", token: "tok only" });
    const started = await caller().order.createCheckout(checkoutInput);
    expect(started.url).toBe(hostedCheckoutUrl("tok only", "https://sandbox-api.iyzipay.com"));
    expect(started.url).toContain("token=tok%20only");
  });

  it("uses payWithIyzicoPageUrl when paymentPageUrl is missing", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    globalThis.fetch = async () => Response.json({
      status: "success",
      token: "tok_pwi",
      payWithIyzicoPageUrl: "https://sandbox-pwi.iyzipay.com/checkout?token=tok_pwi",
    });
    const started = await caller().order.createCheckout(checkoutInput);
    expect(started.url).toBe("https://sandbox-pwi.iyzipay.com/checkout?token=tok_pwi");
  });

  it("does not send the shopper to the cart while 3D Secure is still open", async () => {
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
    const destination = await completeIyzicoCheckout("tok_fail", orderNumber, false);
    expect(destination).toBeNull();
    const order = await caller().order.byNumber({ orderNumber });
    expect(order?.status).toBe("pending");
    const present = await caller().product.present({ ids: [9002] });
    expect(present[0]?.isAvailable).toBe(0);
  });

  it("opens the receipt when the shopper comes back after SMS", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    let orderNumber = "";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/detail")) {
        return Response.json({ status: "success", paymentStatus: "SUCCESS", paymentId: "pay_sms", conversationId: orderNumber, basketId: orderNumber });
      }
      return Response.json({ status: "success", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_sms", token: "tok_sms" });
    };
    const started = await caller().order.createCheckout(checkoutInput);
    orderNumber = started.orderNumber;
    const destination = await completeIyzicoCheckout("tok_sms", orderNumber, true);
    expect(destination).toBe(`/siparis-basarili?order=${encodeURIComponent(orderNumber)}`);
    const order = await caller().order.byNumber({ orderNumber });
    expect(order?.status).toBe("paid");
  });

  it("keeps the 3D Secure page open while iyzico is still confirming", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    let orderNumber = "";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/detail")) {
        return Response.json({ status: "success", paymentStatus: "CALLBACK_THREEDS", conversationId: orderNumber, basketId: orderNumber });
      }
      return Response.json({ status: "success", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_wait", token: "tok_wait" });
    };
    const started = await caller().order.createCheckout(checkoutInput);
    orderNumber = started.orderNumber;
    const destination = await completeIyzicoCheckout("tok_wait", orderNumber, false);
    expect(destination).toBeNull();
    const order = await caller().order.byNumber({ orderNumber });
    expect(order?.status).toBe("pending");
  });

  it("opens the receipt when retrieve is delayed but the shopper already returned", async () => {
    process.env.IYZICO_API_KEY = "sandbox-key";
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    let orderNumber = "";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/detail")) throw new Error("temporarily unavailable");
      return Response.json({ status: "success", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_slow", token: "tok_slow" });
    };
    const started = await caller().order.createCheckout(checkoutInput);
    orderNumber = started.orderNumber;
    const destination = await completeIyzicoCheckout("tok_slow", orderNumber, true);
    expect(destination).toBe(`/siparis-basarili?order=${encodeURIComponent(orderNumber)}`);
    const order = await caller().order.byNumber({ orderNumber });
    expect(order?.status).toBe("paid");
  });

  it("uses the live api, SITE_URL callback and a real TCKN when keys are not sandbox", async () => {
    process.env.IYZICO_API_KEY = "live-merchant-key";
    process.env.IYZICO_SECRET_KEY = "live-merchant-secret";
    process.env.SITE_URL = "https://carmenantika.com/";
    expect(iyzicoConfig().baseUrl).toBe("https://api.iyzipay.com");
    expect(isValidTckn("10000000146")).toBe(true);
    expect(isValidTckn("11111111111")).toBe(false);
    expect(publicOrigin({ protocol: "http", headers: { host: "localhost:3000" } })).toBe("https://carmenantika.com");

    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "")) as {
        callbackUrl: string;
        buyer: { identityNumber: string };
      };
      expect(body.callbackUrl).toBe("https://carmenantika.com/api/iyzico/callback");
      expect(body.buyer.identityNumber).toBe("10000000146");
      return Response.json({ status: "success", paymentPageUrl: "https://cpp.iyzipay.com?token=tok_live", token: "tok_live" });
    };

    const started = await caller().order.createCheckout({
      ...checkoutInput,
      productIds: [9003],
      customerIdentityNumber: "10000000146",
    });
    expect(started.url).toContain("cpp.iyzipay.com");
    expect(started.url).not.toContain("sandbox");
  });

  it("refuses live checkout without a valid TCKN", async () => {
    process.env.IYZICO_API_KEY = "live-merchant-key";
    process.env.IYZICO_SECRET_KEY = "live-merchant-secret";
    await expect(caller().order.createCheckout(checkoutInput)).rejects.toThrow(/TC kimlik/);
    await expect(caller().order.createCheckout({ ...checkoutInput, customerIdentityNumber: "11111111111" })).rejects.toThrow(/TC kimlik/);
  });
});
