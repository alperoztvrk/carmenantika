import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  archiveProduct,
  createOrder,
  createProduct,
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
import { getStripeClient } from "./stripe";

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
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    localStatus: publicProcedure.query(() => {
      const enabled = !ENV.isProduction;
      return { enabled, passwordHint: enabled && !process.env.LOCAL_ADMIN_PASSWORD ? "carmen" : null };
    }),
    localLogin: publicProcedure.input(z.object({ password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
      if (ENV.isProduction) throw new TRPCError({ code: "FORBIDDEN", message: "Yerel giriş yalnızca geliştirme ortamında açık." });
      const expected = process.env.LOCAL_ADMIN_PASSWORD || "carmen";
      if (input.password !== expected) throw new TRPCError({ code: "UNAUTHORIZED", message: "Şifre yanlış." });
      const sessionToken = await sdk.createSessionToken("local-admin", { name: "Carmen", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true } as const;
    }),
  }),

  product: router({
    list: publicProcedure.query(() => listProducts(false)),
    getBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(({ input }) => getProductBySlug(input.slug)),
    adminList: adminProcedure.query(() => listProducts(true)),
    adminUploadImage: adminProcedure
      .input(z.object({ fileName: z.string().min(1).max(180), contentType: z.string().min(1), dataBase64: z.string().min(20) }))
      .mutation(async ({ input }) => {
        const data = Buffer.from(input.dataBase64, "base64");
        if (data.byteLength > 8 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Görsel 8 MB'dan küçük olmalı." });
        const result = await storagePut(`carmen-antika/products/${Date.now()}-${input.fileName}`, data, input.contentType);
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
        shippingAddress: z.string().trim().max(1000),
        productIds: z.array(z.number().int().positive()).min(1).max(20),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.customerName.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Ad soyad eksik." });
        const phoneDigits = input.customerPhone.replace(/\D/g, "");
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Telefon numarasını başında 0 ile, eksiksiz yaz." });
        }
        if (input.shippingAddress.length < 8) throw new TRPCError({ code: "BAD_REQUEST", message: "Teslimat adresi eksik." });
        if (!ENV.stripeSecretKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe anahtarı yok. Proje klasöründeki .env dosyasına STRIPE_SECRET_KEY ekleyip sunucuyu yeniden başlat." });
        }
        const stripe = getStripeClient();
        const uniqueIds = Array.from(new Set(input.productIds));
        const availableProducts = await listProducts(false);
        const selected = availableProducts.filter((product) => uniqueIds.includes(product.id));
        if (selected.length !== uniqueIds.length) {
          throw new TRPCError({ code: "CONFLICT", message: "Sepetteki parçalardan biri artık mevcut değil." });
        }

        const totalCents = selected.reduce((sum, product) => sum + product.priceCents, 0);
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

        const origin = ctx.req.headers.origin || `${ctx.req.protocol}://${ctx.req.headers.host}`;
        try {
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            client_reference_id: String(order.id),
            allow_promotion_codes: true,
            line_items: selected.map((product) => ({
              price_data: {
                currency: "try",
                product_data: { name: product.name, description: product.shortDescription || undefined },
                unit_amount: product.priceCents,
              },
              quantity: 1,
            })),
            metadata: {
              order_id: String(order.id),
              order_number: orderNumber,
              customer_name: input.customerName,
              customer_phone: input.customerPhone,
            },
            payment_intent_data: {
              metadata: {
                order_id: String(order.id),
                order_number: orderNumber,
                customer_phone: input.customerPhone,
              },
            },
            success_url: `${origin}/siparis-basarili?order=${encodeURIComponent(orderNumber)}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/sepet?iptal=${encodeURIComponent(orderNumber)}`,
          });
          await updateOrder(order.id, { stripeCheckoutSessionId: session.id });
          return { url: session.url, orderNumber };
        } catch (error) {
          await updateProductsAvailability(selected.map((product) => product.id), 1);
          await updateOrder(order.id, { status: "cancelled" });
          const detail = error instanceof Error ? error.message : "";
          console.error("[Stripe] checkout failed", detail);
          if (/invalid api key|expired api key/i.test(detail)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe anahtarı geçersiz. .env içindeki STRIPE_SECRET_KEY değerini kontrol edip sunucuyu yeniden başlat." });
          }
          if (/currency/i.test(detail)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe hesabında Türk lirası (TRY) açık değil. Dashboard’dan TRY’yi etkinleştir." });
          }
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ödeme sayfası açılamadı. Biraz sonra tekrar dene." });
        }
      }),
    confirmPayment: publicProcedure
      .input(z.object({ orderNumber: z.string().min(1), sessionId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const order = await getOrderByNumber(input.orderNumber);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Sipariş bulunamadı." });
        if (order.status === "paid") return order;
        if (!ENV.stripeSecretKey) return order;
        const session = await getStripeClient().checkout.sessions.retrieve(input.sessionId);
        const matches = session.metadata?.order_id === String(order.id) || session.metadata?.order_number === order.orderNumber;
        if (!matches) throw new TRPCError({ code: "BAD_REQUEST", message: "Ödeme kaydı bu siparişle eşleşmiyor." });
        if (session.payment_status !== "paid") return order;
        const intent = typeof session.payment_intent === "string" ? session.payment_intent : null;
        const email = session.customer_details?.email ?? "";
        const phone = session.customer_details?.phone || order.customerPhone;
        await updateOrder(order.id, { customerEmail: email || order.customerEmail, customerPhone: phone });
        return markOrderPaid(order.id, intent);
      }),
    cancelCheckout: publicProcedure
      .input(z.object({ orderNumber: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const order = await getOrderByNumber(input.orderNumber);
        if (!order || order.status !== "pending") return { ok: true };
        await updateProductsAvailability(order.items.map((item) => item.productId), 1);
        await updateOrder(order.id, { status: "cancelled" });
        return { ok: true };
      }),
    byNumber: publicProcedure.input(z.object({ orderNumber: z.string().min(1) })).query(({ input }) => getOrderByNumber(input.orderNumber)),
    mine: protectedProcedure.query(({ ctx }) => listOrdersForUser(ctx.user.id)),
    adminList: adminProcedure.query(() => listOrders()),
  }),
});

export type AppRouter = typeof appRouter;
