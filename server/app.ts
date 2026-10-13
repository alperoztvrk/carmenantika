import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { createContext } from "./_core/context";
import { registerStripeWebhook } from "./stripe";
import { registerIyzicoCallback } from "./iyzicoCallback";
import { iyzicoStatusLine } from "./iyzico";
import { assertLiveConfig } from "./liveGuard";
import { hydrateShop } from "./shopHydrate";
import { appRouter } from "./routers";

function securityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

export async function createApp(options?: { serveFiles?: boolean }) {
  if (process.env.NODE_ENV === "production") assertLiveConfig();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  const healthz = (_req: express.Request, res: express.Response) => {
    res.type("text").send("ok");
  };
  app.get("/healthz", healthz);
  app.get("/api/healthz", healthz);
  registerStripeWebhook(app);
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));
  registerIyzicoCallback(app);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const serveFiles = options?.serveFiles ?? (process.env.NODE_ENV === "production" && !process.env.VERCEL);
  if (serveFiles) {
    const { serveStatic } = await import("./_core/vite");
    serveStatic(app);
  }

  await hydrateShop();
  console.log(`[iyzico] ${iyzicoStatusLine()}`);
  return app;
}
