import express, { type Express } from "express";
import Stripe from "stripe";
import { getOrderById, markOrderPaid, updateOrder, updateProductsAvailability } from "./db";
import { ENV } from "./_core/env";

function getStripe() {
  if (!ENV.stripeSecretKey) {
    throw new Error("Stripe is not configured. Add payment settings before taking live payments.");
  }
  return new Stripe(ENV.stripeSecretKey);
}

export function getStripeClient() {
  return getStripe();
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!ENV.stripeWebhookSecret) {
      res.status(503).json({ error: "Stripe webhook is not configured" });
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    try {
      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(req.body, signature, ENV.stripeWebhookSecret);

      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe] Test event verified", event.id);
        res.json({ verified: true });
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = Number(session.metadata?.order_id);
        if (Number.isFinite(orderId)) {
          await markOrderPaid(orderId, typeof session.payment_intent === "string" ? session.payment_intent : null);
        }
      }

      if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = Number(session.metadata?.order_id);
        if (Number.isFinite(orderId)) {
          const order = await getOrderById(orderId);
          if (order) await updateProductsAvailability(order.items.map((item) => item.productId), 1);
          await updateOrder(orderId, { status: "cancelled" });
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("[Stripe] Webhook verification failed", error);
      res.status(400).send("Webhook Error");
    }
  });
}
