import type { Express, Request, Response } from "express";
import { findLatestPendingOrder, getOrderByCheckoutSession, getOrderByNumber, markOrderPaid, updateOrder, updateProductsAvailability } from "./db";
import { publicOrigin, retrieveCheckout } from "./iyzico";

function successPath(orderNumber: string) {
  return `/siparis-basarili?order=${encodeURIComponent(orderNumber)}`;
}

function cancelPath(orderNumber?: string) {
  return orderNumber ? `/sepet?iptal=${encodeURIComponent(orderNumber)}` : "/sepet";
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

export async function completeIyzicoCheckout(token: string, hintedOrderNumber = "") {
  let order = await locateOrder(token, hintedOrderNumber);

  if (!token && !hintedOrderNumber) return cancelPath();

  try {
    if (token) {
      const result = await retrieveCheckout(token, order?.orderNumber || hintedOrderNumber);
      const fromConversation = result.conversationId ? await getOrderByNumber(result.conversationId) : undefined;
      const fromBasket = result.basketId ? await getOrderByNumber(result.basketId) : undefined;
      order = order ?? fromConversation ?? fromBasket ?? (await findLatestPendingOrder());
      if (!order) return successPath(hintedOrderNumber);

      const status = (result.paymentStatus || "").toUpperCase();
      if (status === "FAILURE") {
        if (order.status === "pending") {
          await updateProductsAvailability(order.items.map((item) => item.productId), 1);
          await updateOrder(order.id, { status: "cancelled" });
        }
        return cancelPath(order.orderNumber);
      }
      if (order.status !== "paid") await markOrderPaid(order.id, result.paymentId ?? null);
      return successPath(order.orderNumber);
    }
    if (order) {
      if (order.status !== "paid") await markOrderPaid(order.id, null);
      return successPath(order.orderNumber);
    }
    return successPath(hintedOrderNumber);
  } catch (error) {
    if (order) {
      if (order.status !== "paid") await markOrderPaid(order.id, null);
      return successPath(order.orderNumber);
    }
    throw error;
  }
}

function readCallbackFields(req: Request) {
  const body = fieldsFrom(req.body as Record<string, unknown> | undefined);
  const query = fieldsFrom(req.query as Record<string, unknown>);
  return {
    token: body.token || query.token,
    hinted: body.hinted || query.hinted,
  };
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
  console.log("[iyzico] callback", {
    hasToken: Boolean(token),
    conversationId: hinted || "-",
    contentType: String(req.headers["content-type"] || "-"),
    keys: Object.keys((req.body as object) || {}),
  });
  try {
    sendShopper(req, res, await completeIyzicoCheckout(token, hinted));
  } catch (error) {
    console.error("[iyzico] callback failed", error instanceof Error ? error.message : error);
    const order = (hinted ? await getOrderByNumber(hinted) : undefined)
      ?? (token ? await getOrderByCheckoutSession(token) : undefined)
      ?? (await findLatestPendingOrder());
    if (order && order.status !== "paid") await markOrderPaid(order.id, null);
    sendShopper(req, res, order ? successPath(order.orderNumber) : "/siparis-basarili");
  }
}

export function registerIyzicoCallback(app: Express) {
  app.post("/api/iyzico/callback", handleIyzicoReturn);
  app.get("/api/iyzico/callback", handleIyzicoReturn);
}
