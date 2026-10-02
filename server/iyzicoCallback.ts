import type { Express, Request, Response } from "express";
import { findLatestPendingOrder, getOrderByCheckoutSession, getOrderByNumber, markOrderPaid } from "./db";
import { publicOrigin, retrieveCheckout, type IyzicoPayment } from "./iyzico";

function successPath(orderNumber: string) {
  return `/siparis-basarili?order=${encodeURIComponent(orderNumber)}`;
}

function pick(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0].trim();
  }
  return "";
}

function fieldsFrom(record: Record<string, unknown> | undefined) {
  if (!record) return { token: "", hinted: "" };
  return {
    token: pick(record, ["token", "paymentToken", "checkoutToken", "tokenId"]),
    hinted: pick(record, ["conversationId", "conversationid", "basketId", "basketid"]),
  };
}

async function locateOrder(token: string, hintedOrderNumber: string) {
  const hinted = hintedOrderNumber ? await getOrderByNumber(hintedOrderNumber) : undefined;
  const stored = token ? await getOrderByCheckoutSession(token) : undefined;
  const known = stored ?? hinted;
  if (known) return known;
  if (token || hintedOrderNumber) return findLatestPendingOrder();
  return undefined;
}

function wait(ms: number) {
  if (process.env.NODE_ENV === "test") return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function paymentStatusOf(result: IyzicoPayment) {
  return (result.paymentStatus || "").toUpperCase();
}

export async function completeIyzicoCheckout(token: string, hintedOrderNumber = "", allowRedirect = false) {
  let order = await locateOrder(token, hintedOrderNumber);
  if (!token) return order && allowRedirect ? successPath(order.orderNumber) : null;

  const attempts = process.env.NODE_ENV === "test" ? 1 : 6;
  let last: IyzicoPayment | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      last = await retrieveCheckout(token, order?.orderNumber || hintedOrderNumber);
      const fromConversation = last.conversationId ? await getOrderByNumber(last.conversationId) : undefined;
      const fromBasket = last.basketId ? await getOrderByNumber(last.basketId) : undefined;
      order = order ?? fromConversation ?? fromBasket ?? (await findLatestPendingOrder());
      const status = paymentStatusOf(last);
      console.log("[iyzico] retrieve", { attempt, status, paymentId: last.paymentId || "-", error: last.errorMessage || "-" });
      if (status === "SUCCESS" && order) {
        if (order.status !== "paid") await markOrderPaid(order.id, last.paymentId ?? null);
        return successPath(order.orderNumber);
      }
    } catch (error) {
      console.error("[iyzico] retrieve failed", error instanceof Error ? error.message : error);
    }
    if (attempt < attempts) await wait(700);
  }

  if (!allowRedirect) return null;
  if (!order && !hintedOrderNumber) return null;
  return successPath(order?.orderNumber || hintedOrderNumber);
}

function readCallbackFields(req: Request) {
  const body = fieldsFrom(req.body as Record<string, unknown> | undefined);
  const query = fieldsFrom(req.query as Record<string, unknown>);
  return {
    token: body.token || query.token,
    hinted: body.hinted || query.hinted,
  };
}

function inIframe(req: Request) {
  const dest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
  return dest === "iframe" || dest === "empty";
}

function sendShopper(req: Request, res: Response, path: string) {
  const url = path.startsWith("http") ? path : `${publicOrigin(req)}${path.startsWith("/") ? path : `/${path}`}`;
  const href = url.replace(/&/g, "&amp;");
  res.status(200).set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  }).send(`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Carmen Antika</title>
<style>html,body{margin:0;min-height:100vh;background:#f3ebdd;color:#2f251f;display:grid;place-items:center;font:15px/1.6 "DM Sans",system-ui,sans-serif}a{color:#a95238}</style>
</head>
<body>
<p>Siparişin hazırlanıyor…</p>
<p><a href="${href}">Sipariş ekranına geç</a></p>
<script>try{window.top.location.replace(${JSON.stringify(url)});}catch(e){location.replace(${JSON.stringify(url)});}</script>
</body>
</html>`);
}

async function handleIyzicoReturn(req: Request, res: Response) {
  const { token, hinted } = readCallbackFields(req);
  const allowRedirect = !inIframe(req);
  console.log("[iyzico] callback", {
    hasToken: Boolean(token),
    conversationId: hinted || "-",
    contentType: String(req.headers["content-type"] || "-"),
    keys: Object.keys((req.body as object) || {}),
    dest: String(req.headers["sec-fetch-dest"] || "-"),
    allowRedirect,
  });
  try {
    const path = await completeIyzicoCheckout(token, hinted, allowRedirect);
    if (!path) {
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).send("<!doctype html><html><body></body></html>");
      return;
    }
    sendShopper(req, res, path);
  } catch (error) {
    console.error("[iyzico] callback failed", error instanceof Error ? error.message : error);
    const order = (hinted ? await getOrderByNumber(hinted) : undefined)
      ?? (token ? await getOrderByCheckoutSession(token) : undefined)
      ?? (await findLatestPendingOrder());
    if (!allowRedirect) {
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).send("<!doctype html><html><body></body></html>");
      return;
    }
    sendShopper(req, res, order ? successPath(order.orderNumber) : "/");
  }
}

export function registerIyzicoCallback(app: Express) {
  app.post("/api/iyzico/callback", handleIyzicoReturn);
  app.get("/api/iyzico/callback", handleIyzicoReturn);
}
