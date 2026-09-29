import type { Express } from "express";
import { getOrderByCheckoutSession, getOrderByNumber, markOrderPaid, updateOrder, updateProductsAvailability } from "./db";
import { retrieveCheckout } from "./iyzico";

export async function completeIyzicoCheckout(token: string, hintedOrderNumber = "") {
  if (!token) return hintedOrderNumber ? `/sepet?iptal=${encodeURIComponent(hintedOrderNumber)}` : "/sepet";
  const result = await retrieveCheckout(token, hintedOrderNumber || token);
  const orderNumber = result.conversationId || result.basketId || hintedOrderNumber;
  const order = orderNumber ? await getOrderByNumber(orderNumber) : undefined;
  if (!order) return "/sepet";
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== token) return "/sepet";
  const matches = !result.conversationId || result.conversationId === order.orderNumber || result.basketId === order.orderNumber;
  if (result.paymentStatus === "SUCCESS" && matches) {
    if (order.status !== "paid") await markOrderPaid(order.id, result.paymentId ?? null);
    return `/siparis-basarili?order=${encodeURIComponent(order.orderNumber)}`;
  }
  if (order.status === "pending") {
    await updateProductsAvailability(order.items.map((item) => item.productId), 1);
    await updateOrder(order.id, { status: "cancelled" });
  }
  return `/sepet?iptal=${encodeURIComponent(order.orderNumber)}`;
}

export function registerIyzicoCallback(app: Express) {
  app.post("/api/iyzico/callback", async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const hinted = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
    try {
      res.redirect(303, await completeIyzicoCheckout(token, hinted));
    } catch (error) {
      console.error("[iyzico] callback failed", error instanceof Error ? error.message : error);
      const hintedOrder = hinted ? await getOrderByNumber(hinted) : undefined;
      const order = hintedOrder ?? (token ? await getOrderByCheckoutSession(token) : undefined);
      if (order?.status === "pending") {
        res.redirect(303, `/siparis-basarili?order=${encodeURIComponent(order.orderNumber)}`);
        return;
      }
      res.redirect(303, "/sepet");
    }
  });
}
