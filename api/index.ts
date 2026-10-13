import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { createApp } from "../server/app";

export const config = {
  maxDuration: 60,
  api: { bodyParser: false },
};

const appPromise: Promise<Express> = createApp({ serveFiles: false });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
