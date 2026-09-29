import type { Express, Request, Response } from "express";
import { getOrderByCheckoutSession, getOrderByNumber, markOrderPaid, updateOrder, updateProductsAvailability } from "./db";
import { publicOrigin, retrieveCheckout } from "./iyzico";

function successPath(orderNumber: string) {
  return `/siparis-basarili?order=${encodeURIComponent(orderNumber)}`;
}

function cancelPath(orderNumber?: string) {
  return orderNumber ? `/sepet?iptal=${encodeURIComponent(orderNumber)}` : "/sepet";
}

export async function completeIyzicoCheckout(token: string, hintedOrderNumber = "") {
  const hinted = hintedOrderNumber ? await getOrderByNumber(hintedOrderNumber) : undefined;
  const stored = token ? await getOrderByCheckoutSession(token) : undefined;
  let order = stored ?? hinted;

  if (!token) return order ? successPath(order.orderNumber) : cancelPath(hintedOrderNumber);

  try {
    const result = await retrieveCheckout(token, order?.orderNumber || hintedOrderNumber);
    const fromConversation = result.conversationId ? await getOrderByNumber(result.conversationId) : undefined;
    const fromBasket = result.basketId ? await getOrderByNumber(result.basketId) : undefined;
    order = order ?? fromConversation ?? fromBasket;
    if (!order) return cancelPath();

    const status = (result.paymentStatus || "").toUpperCase();
    if (status === "FAILURE") {
      if (order.status === "pending") {
        await updateProductsAvailability(order.items.map((item) => item.productId), 1);
        await updateOrder(order.id, { status: "cancelled" });
      }
      return cancelPath(order.orderNumber);
    }
    if (status === "SUCCESS" && order.status !== "paid") {
      await markOrderPaid(order.id, result.paymentId ?? null);
    }
    return successPath(order.orderNumber);
  } catch (error) {
    if (order) return successPath(order.orderNumber);
    throw error;
  }
}

function readField(req: Request, name: string) {
  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, unknown>;
  const value = body?.[name] ?? query[name];
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

function sendShopper(req: Request, res: Response, path: string) {
  const url = path.startsWith("http") ? path : `${publicOrigin(req)}${path}`;
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
  const token = readField(req, "token");
  const hinted = readField(req, "conversationId");
  try {
    sendShopper(req, res, await completeIyzicoCheckout(token, hinted));
  } catch (error) {
    console.error("[iyzico] callback failed", error instanceof Error ? error.message : error);
    const hintedOrder = hinted ? await getOrderByNumber(hinted) : undefined;
    const order = hintedOrder ?? (token ? await getOrderByCheckoutSession(token) : undefined);
    sendShopper(req, res, order ? successPath(order.orderNumber) : "/sepet");
  }
}

export function registerIyzicoCallback(app: Express) {
  app.post("/api/iyzico/callback", handleIyzicoReturn);
  app.get("/api/iyzico/callback", handleIyzicoReturn);
}
