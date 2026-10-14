import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app";

export const config = {
  maxDuration: 60,
  api: { bodyParser: false },
};

const appPromise = createApp();

function requestUrl(req: IncomingMessage) {
  const raw = req.url || "/";
  if (raw.startsWith("/api") || raw.startsWith("/healthz") || raw.startsWith("/manus-storage") || raw.startsWith("/shop-image")) return raw;
  return raw.startsWith("/") ? `/api${raw}` : `/api/${raw}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    req.url = requestUrl(req);
    const app = await appPromise;
    (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
  } catch (error) {
    console.error("[api]", error instanceof Error ? error.stack ?? error.message : error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "api" }));
  }
}
