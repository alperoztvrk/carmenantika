const LOCAL_POOL = [
  "/photos/radio.jpg",
  "/photos/camera.jpg",
  "/photos/polaroid.jpg",
  "/photos/toy.jpg",
  "/photos/frames.jpg",
  "/photos/typewriter.jpg",
  "/photos/collection.jpg",
  "/photos/story-market.jpg",
  "/photos/hero-stall.jpg",
];

const KNOWN: Record<string, string> = {
  "flea-stall_64c3f112.jpg": "/photos/hero-stall.jpg",
  "market-objects_9b5b96e4.jpeg": "/photos/story-market.jpg",
};

function hashKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  return hash;
}

export function fallbackPhoto(seed = "carmen") {
  return LOCAL_POOL[hashKey(seed) % LOCAL_POOL.length];
}

export function photoSrc(src?: string | null) {
  if (!src) return fallbackPhoto("empty");
  if (src.startsWith("/photos/")) return src;
  if (src.includes("/manus-storage/")) {
    const key = src.split("/manus-storage/")[1]?.split("?")[0] ?? src;
    const file = decodeURIComponent(key.split("/").pop() ?? key);
    if (KNOWN[file] || KNOWN[key]) return KNOWN[file] ?? KNOWN[key];
  }
  return src;
}
