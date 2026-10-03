import crypto from "node:crypto";
import { ADMIN_SESSION_MS, COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  archiveProduct,
  createOrder,
  createProduct,
  deleteOrder,
  deleteProduct,
  getOrderByNumber,
  getProductBySlug,
  listOrders,
  markOrderPaid,
  listOrdersForUser,
  listProducts,
  makeOrderNumber,
  updateProductsAvailability,
  updateProduct,
  updateOrder,
} from "./db";
import { storagePut } from "./storage";
import { rememberLocalCheckoutToken } from "./localOrders";
import { phonesMatch, readGuestOrderNumbers, rememberGuestOrder } from "./guestOrders";
import { createReview, deleteReview, listReviews } from "./localReviews";
import { buyerIdentityNumber, buyerIp, initializeCheckout, iyzicoConfigured, iyzicoIsSandbox, publicOrigin, retrieveCheckout } from "./iyzico";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const checkoutAttempts = new Map<string, { count: number; resetAt: number }>();
const reviewAttempts = new Map<string, { count: number; resetAt: number }>();

function localAdminEnabled() {
  return !ENV.isProduction || Boolean(ENV.localAdminPassword);
}

function localAdminPassword() {
  if (ENV.localAdminPassword) return ENV.localAdminPassword;
  return ENV.isProduction ? "" : "carmen";
}

function allowAttempt(store: Map<string, { count: number; resetAt: number }>, ip: string, max: number) {
  if (process.env.NODE_ENV === "test") return true;
  const now = Date.now();
  const current = store.get(ip);
  if (!current || now >= current.resetAt) {
    store.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

function allowLoginAttempt(ip: string) {
  return allowAttempt(loginAttempts, ip, 8);
}

function allowCheckoutAttempt(ip: string) {
  return allowAttempt(checkoutAttempts, ip, 20);
}

function allowReviewAttempt(ip: string) {
  return allowAttempt(reviewAttempts, ip, 4);
}

function cleanName(value: string) {
  return value.replace(/[^A-Za-zÀ-ÿÇĞİÖŞÜçğıöşüâîûÂÎÛ'\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanReviewBody(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function passwordsMatch(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(right, right);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

function openInspect() {
  return process.env.NODE_ENV === "test";
}

async function ownsGuestOrder(ctx: { user: { role?: string } | null; req: { headers: { cookie?: string } } }, orderNumber: string) {
  if (ctx.user?.role === "admin") return true;
  const guest = await readGuestOrderNumbers(ctx.req);
  return guest.includes(orderNumber);
}

async function canReadOrder(ctx: { user: { role?: string } | null; req: { headers: { cookie?: string } } }, orderNumber: string) {
  if (openInspect()) return true;
  return ownsGuestOrder(ctx, orderNumber);
}

async function ordersForGuest(req: { headers: { cookie?: string } }) {
  const numbers = await readGuestOrderNumbers(req);
  const found = await Promise.all(numbers.map((orderNumber) => getOrderByNumber(orderNumber)));
  return found
    .filter((order): order is NonNullable<typeof order> => Boolean(order))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

const productFields = {
  name: z.string(),
  category: z.string(),
  era: z.string(),
  priceCents: z.number().int().min(0),
  shortDescription: z.string(),
  description: z.string(),
  condition: z.string(),
  dimensions: z.string().optional(),
  imageUrl: z.string(),
  imageKey: z.string().optional(),
  tag: z.string().optional(),
  isAvailable: z.number().int().min(0).max(1).optional(),
  isFeatured: z.number().int().min(0).max(1).optional(),
};

const slugify = (value: string) => value
  .toLocaleLowerCase("tr-TR")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .replace(/ğ/g, "g")
  .replace(/ü/g, "u")
  .replace(/ş/g, "s")
  .replace(/ö/g, "o")
  .replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.cookie(COOKIE_NAME, "", { ...cookieOptions, expires: new Date(0), maxAge: 0 });
      return { success: true } as const;
    }),
    localStatus: publicProcedure.query(() => {
      const enabled = localAdminEnabled();
      return {
        enabled,
        live: ENV.isProduction,
        passwordHint: null,
      };
    }),
    localLogin: publicProcedure.input(z.object({ password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
      if (!localAdminEnabled()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Yönetim girişi bu sunucuda kapalı. LOCAL_ADMIN_PASSWORD ekleyip sunucuyu yeniden başlat." });
      }
      const ip = buyerIp(ctx.req);
      if (!allowLoginAttempt(ip)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla deneme. Bir süre sonra tekrar dene." });
      }
      const expected = localAdminPassword();
      if (!expected || !passwordsMatch(input.password, expected)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Şifre yanlış." });
      }
      clearLoginAttempts(ip);
      const sessionToken = await sdk.createSessionToken("local-admin", { name: "Carmen", expiresInMs: ADMIN_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
      return { success: true } as const;
    }),
  }),

  product: router({
    list: publicProcedure.query(() => listProducts(false)),
    present: publicProcedure
      .input(z.object({ ids: z.array(z.number().int().positive()).max(30) }))
      .query(async ({ input }) => {
        if (input.ids.length === 0) return [];
        const wanted = new Set(input.ids);
        const all = await listProducts(true);
        return all
          .filter((product) => wanted.has(product.id))
          .map((product) => ({
            id: product.id,
            slug: product.slug,
            name: product.name,
            priceCents: product.priceCents,
            imageUrl: product.imageUrl,
            shortDescription: product.shortDescription,
            isAvailable: product.isAvailable,
          }));
      }),
    getBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(({ input }) => getProductBySlug(input.slug)),
    adminList: adminProcedure.query(() => listProducts(true)),
    adminUploadImage: adminProcedure
      .input(z.object({ fileName: z.string().min(1).max(180), contentType: z.string().min(1), dataBase64: z.string().min(20) }))
      .mutation(async ({ input }) => {
        const data = Buffer.from(input.dataBase64, "base64");
        if (data.byteLength > 8 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Görsel 8 MB'dan küçük olmalı." });
        const type = input.contentType.toLowerCase();
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Sadece jpeg, png, webp veya gif yükle." });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "").slice(-80) || "gorsel.jpg";
        const result = await storagePut(`carmen-antika/products/${Date.now()}-${safeName}`, data, type);
        return result;
      }),
    adminCreate: adminProcedure
      .input(z.object(productFields))
      .mutation(({ input }) => createProduct({ ...input, name: input.name.trim() || "İsimsiz parça", category: input.category.trim() || "Objeler", slug: `${slugify(input.name) || "parca"}-${Date.now().toString(36)}`, currency: "try", isAvailable: input.isAvailable ?? 1, isFeatured: input.isFeatured ?? 0 })),
    adminUpdate: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: z.object(productFields).partial() }))
      .mutation(({ input }) => updateProduct(input.id, input.data)),
    adminArchive: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => archiveProduct(input.id)),
    adminDelete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const removed = await deleteProduct(input.id);
        if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Ürün bulunamadı." });
        return { id: input.id };
      }),
  }),

  order: router({
    createCheckout: publicProcedure
      .input(z.object({
        customerName: z.string().trim().max(255),
        customerPhone: z.string().trim().max(40),
        customerIdentityNumber: z.string().trim().max(20).optional(),
        shippingAddress: z.string().trim().max(1000),
        productIds: z.array(z.number().int().positive()).min(1).max(20),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.customerName.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Ad soyad eksik." });
        const phoneDigits = input.customerPhone.replace(/\D/g, "");
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Telefon numarasını başında 0 ile, eksiksiz yaz." });
        }
        if (!iyzicoConfigured()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "iyzico anahtarı yok. Proje klasöründeki .env dosyasına IYZICO_API_KEY ve IYZICO_SECRET_KEY ekleyip sunucuyu yeniden başlat." });
        }
        const liveHost = (() => {
          try {
            const host = new URL(ENV.siteUrl.startsWith("http") ? ENV.siteUrl : `https://${ENV.siteUrl}`).hostname;
            return Boolean(host) && host !== "localhost" && host !== "127.0.0.1";
          } catch {
            return false;
          }
        })();
        if ((ENV.isProduction || liveHost) && iyzicoIsSandbox()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Canlı sitede sandbox iyzico anahtarı kullanılamaz. merchant.iyzipay.com canlı anahtarlarını .env dosyasına yazıp sunucuyu yeniden başlat." });
        }
        if ((ENV.isProduction || liveHost) && !/^https:\/\//i.test(ENV.siteUrl)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Canlı ödeme için SITE_URL https://senin-domainin.com olmalı." });
        }
        if (!allowCheckoutAttempt(buyerIp(ctx.req))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla deneme. Bir süre sonra tekrar dene." });
        }
        const identityNumber = buyerIdentityNumber(input.customerIdentityNumber);
        if (!identityNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Canlı ödemede geçerli bir TC kimlik numarası gerekli." });
        }
        const uniqueIds = Array.from(new Set(input.productIds));
        const availableProducts = await listProducts(false);
        const selected = availableProducts.filter((product) => uniqueIds.includes(product.id));
        if (selected.length !== uniqueIds.length) {
          throw new TRPCError({ code: "CONFLICT", message: "Sepetteki parçalardan biri artık mevcut değil." });
        }

        const totalCents = selected.reduce((sum, product) => sum + product.priceCents, 0);
        if (totalCents <= 0 || selected.some((product) => product.priceCents <= 0)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ücretsiz parça için kart ödemesi açılamaz." });
        }
        const orderNumber = makeOrderNumber();
        const order = await createOrder(
          {
            orderNumber,
            userId: ctx.user?.id ?? null,
            customerName: input.customerName,
            customerEmail: "",
            customerPhone: input.customerPhone,
            shippingAddress: input.shippingAddress,
            totalCents,
            currency: "try",
            status: "pending",
          },
          selected.map((product) => ({
            orderId: 0,
            productId: product.id,
            productName: product.name,
            priceCents: product.priceCents,
            quantity: 1,
            imageUrl: product.imageUrl,
          })),
        );
        if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sipariş oluşturulamadı." });
        await updateProductsAvailability(selected.map((product) => product.id), 0);

        const origin = publicOrigin(ctx.req);
        try {
          const session = await initializeCheckout({
            orderNumber,
            callbackUrl: `${origin}/api/iyzico/callback`,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            shippingAddress: input.shippingAddress,
            identityNumber,
            ip: buyerIp(ctx.req),
            items: selected.map((product) => ({
              id: product.id,
              name: product.name,
              category: product.category,
              priceCents: product.priceCents,
            })),
          });
          const token = session.token;
          if (token) {
            await updateOrder(order.id, { stripeCheckoutSessionId: token.slice(0, 255) });
            rememberLocalCheckoutToken(token, orderNumber);
          }
          await rememberGuestOrder(ctx.req, ctx.res, orderNumber);
          return { url: session.url, orderNumber };
        } catch (error) {
          await updateProductsAvailability(selected.map((product) => product.id), 1);
          await updateOrder(order.id, { status: "cancelled" });
          const detail = error instanceof Error ? error.message : "";
          const errorCode = error instanceof Error && "errorCode" in error ? String((error as { errorCode?: string }).errorCode ?? "") : "";
          console.error("[iyzico] checkout failed", errorCode, detail);
          if (/api key|secret key|authorization|imza|signature|api bilgileri/i.test(detail)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "iyzico bu anahtarı tanımıyor. merchant.iyzipay.com → Ayarlar → API Anahtarları. Tırnak koyma. Kaydedince sunucuyu yeniden başlat." });
          }
          if (/aborted|timeout/i.test(detail)) {
            throw new TRPCError({ code: "TIMEOUT", message: "iyzico yanıt vermedi. Ödemeyi tekrar dene." });
          }
          if (detail && detail.length < 180 && !/iyzico anahtarı yok/.test(detail)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Ödeme sayfası açılamadı. ${detail}` });
          }
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ödeme sayfası açılamadı. Biraz sonra tekrar dene." });
        }
      }),
    confirmPayment: publicProcedure
      .input(z.object({ orderNumber: z.string().min(1), sessionId: z.string().min(1).optional() }))
      .mutation(async ({ input, ctx }) => {
        const order = await getOrderByNumber(input.orderNumber);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Sipariş bulunamadı." });
        if (order.status === "paid") return order;
        if (order.status !== "pending" && order.status !== "cancelled") return order;
        const token = input.sessionId || order.stripeCheckoutSessionId;
        let latest = order;
        if (token && iyzicoConfigured()) {
          try {
            const result = await retrieveCheckout(token, order.orderNumber);
            if ((result.paymentStatus || "").toUpperCase() === "SUCCESS") {
              latest = await markOrderPaid(order.id, result.paymentId ?? null) ?? order;
            }
          } catch (error) {
            console.error("[iyzico] confirm failed", error instanceof Error ? error.message : error);
          }
        }
        if (!(await canReadOrder(ctx, order.orderNumber))) {
          return { ...latest, customerName: "", customerEmail: "", customerPhone: "", shippingAddress: null };
        }
        return latest;
      }),
    paymentMode: publicProcedure.query(() => ({
      configured: iyzicoConfigured(),
      live: iyzicoConfigured() && !iyzicoIsSandbox(),
      needsIdentity: iyzicoConfigured() && !iyzicoIsSandbox(),
    })),
    cancelCheckout: publicProcedure
      .input(z.object({ orderNumber: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!(await ownsGuestOrder(ctx, input.orderNumber))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sipariş bulunamadı." });
        }
        const order = await getOrderByNumber(input.orderNumber);
        if (!order || order.status !== "pending") return { ok: true };
        await updateProductsAvailability(order.items.map((item) => item.productId), 1);
        await updateOrder(order.id, { status: "cancelled" });
        return { ok: true };
      }),
    byNumber: publicProcedure.input(z.object({ orderNumber: z.string().min(1) })).query(async ({ input, ctx }) => {
      const order = await getOrderByNumber(input.orderNumber);
      if (!order) return null;
      if (!(await canReadOrder(ctx, order.orderNumber))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sipariş bulunamadı." });
      }
      return order;
    }),
    lookup: publicProcedure
      .input(z.object({
        orderNumber: z.string().trim().min(3).max(40),
        customerPhone: z.string().trim().max(40),
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = buyerIp(ctx.req);
        if (!allowLoginAttempt(ip)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla deneme. Bir süre sonra tekrar dene." });
        }
        const order = await getOrderByNumber(input.orderNumber);
        if (!order || !phonesMatch(order.customerPhone, input.customerPhone)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sipariş bulunamadı. Numara ve telefonu kontrol et." });
        }
        await rememberGuestOrder(ctx.req, ctx.res, order.orderNumber);
        return order;
      }),
    mine: publicProcedure.query(async ({ ctx }) => {
      const guest = await ordersForGuest(ctx.req);
      if (!ctx.user) return guest;
      const owned = await listOrdersForUser(ctx.user.id);
      const seen = new Set(guest.map((order) => order.id));
      return [...guest, ...owned.filter((order) => !seen.has(order.id))];
    }),
    adminList: adminProcedure.query(() => listOrders()),
    adminDelete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const removed = await deleteOrder(input.id);
        if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Sipariş bulunamadı." });
        return removed;
      }),
  }),

  review: router({
    list: publicProcedure.query(() => listReviews()),
    create: publicProcedure
      .input(z.object({
        firstName: z.string().trim().max(40),
        lastName: z.string().trim().max(40),
        rating: z.number().int().min(1).max(5),
        body: z.string().trim().max(400),
      }))
      .mutation(({ input, ctx }) => {
        if (!allowReviewAttempt(buyerIp(ctx.req))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Biraz ara ver. Yeni yorum için sonra tekrar dene." });
        }
        const firstName = cleanName(input.firstName);
        const lastName = cleanName(input.lastName);
        const body = cleanReviewBody(input.body);
        if (firstName.length < 2 || lastName.length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ad ve soyadı eksiksiz yaz." });
        }
        return createReview({ firstName, lastName, rating: input.rating, body });
      }),
    adminList: adminProcedure.query(() => listReviews()),
    adminDelete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => {
        if (!deleteReview(input.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Yorum bulunamadı." });
        return { id: input.id };
      }),
  }),
});

export type AppRouter = typeof appRouter;
