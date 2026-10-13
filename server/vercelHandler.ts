import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app";

export const config = {
  maxDuration: 60,
  api: { bodyParser: false },
};

const appPromise = createApp({ serveFiles: false });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
