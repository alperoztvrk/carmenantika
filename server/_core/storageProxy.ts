import type { Express } from "express";
import { ENV } from "./env";

const LOCAL_POOL = [
  "/photos/radio.jpg",
  "/photos/camera.jpg",
  "/photos/polaroid.jpg",
  "/photos/toy.jpg",
  "/photos/frames.jpg",
  "/photos/typewriter.jpg",
  "/photos/collection.jpg",
  "/photos/story-market.jpg",
];

const KNOWN_PHOTOS: Record<string, string> = {
  "flea-stall_64c3f112.jpg": "/photos/hero-stall.jpg",
  "market-objects_9b5b96e4.jpeg": "/photos/story-market.jpg",
};

function localPhotoFor(key: string) {
  const file = decodeURIComponent(key.split("/").pop() ?? key);
  if (KNOWN_PHOTOS[file]) return KNOWN_PHOTOS[file];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 33 + key.charCodeAt(index)) >>> 0;
  return LOCAL_POOL[hash % LOCAL_POOL.length];
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.redirect(302, localPhotoFor(key));
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.redirect(302, localPhotoFor(key));
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.redirect(302, localPhotoFor(key));
    }
  });
}
