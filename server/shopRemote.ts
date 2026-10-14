import crypto from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { packGallery, parseGallery } from "@shared/productImages";
import { storageGetSignedUrl, storagePutStable } from "./storage";

export type ShopSnapshot = {
  version: 1;
  savedAt: string;
  products: unknown[];
  reviews: unknown[];
  orders: unknown[];
  nextReviewId: number;
  nextOrderId: number;
  nextItemId: number;
  tokens: Record<string, string>;
  deletedProductIds?: number[];
  deletedProductSlugs?: string[];
  deletedReviewIds?: number[];
  deletedOrderIds?: number[];
};

const USER_AGENT = "carmen-antika/1.0";
const RENTRY = "https://rentry.co";
const FORGE_SNAPSHOT_KEY = "carmen-antika/shop/v1.snapshot";

let capture: (() => ShopSnapshot) | null = null;
let pending: Promise<void> = Promise.resolve();
let backupsOpen = false;
let queuedWhileClosed = false;
let lastBackup: { savedAt: string; products: number; reviews: number; orders: number } | null = null;
let lastBackupFailed = false;
let recover: ((snapshot: ShopSnapshot) => void) | null = null;
const imageCache = new Map<string, { type: string; bytes: Buffer }>();

export function bindShopBackup(fn: () => ShopSnapshot, apply?: (snapshot: ShopSnapshot) => void) {
  capture = fn;
  recover = apply ?? null;
}

function persistEnabled() {
  return process.env.NODE_ENV !== "test";
}

function backupSecret() {
  return (process.env.SHOP_BACKUP_KEY || process.env.JWT_SECRET || "").trim();
}

function backupIds() {
  const digest = crypto.createHash("sha256").update(`${backupSecret()}:carmen-shop-ids`).digest("hex");
  return {
    slug: `ca${digest.slice(0, 22)}`,
    editCode: digest.slice(22, 46),
  };
}

export function encryptSnapshot(snapshot: ShopSnapshot, secret = backupSecret()) {
  const key = crypto.createHash("sha256").update(`${secret}:carmen-shop-v1`).digest();
  const iv = crypto.randomBytes(12);
  const gzipped = gzipSync(Buffer.from(JSON.stringify(snapshot), "utf8"));
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipped), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `C1.${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

export function decryptSnapshot(payload: string, secret = backupSecret()): ShopSnapshot | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("C1.")) return null;
  try {
    const raw = Buffer.from(trimmed.slice(3), "base64");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const key = crypto.createHash("sha256").update(`${secret}:carmen-shop-v1`).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const unzipped = gunzipSync(Buffer.concat([decipher.update(encrypted), decipher.final()]));
    const parsed = JSON.parse(unzipped.toString("utf8")) as ShopSnapshot;
    if (parsed?.version !== 1 || !Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cookieHeader(setCookies: string[]) {
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function csrfFrom(setCookies: string[]) {
  for (const cookie of setCookies) {
    const match = cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/i);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function csrfFromHtml(html: string) {
  return (
    html.match(/name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)/i)?.[1]
    ?? html.match(/value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/i)?.[1]
    ?? ""
  );
}

export function cookiesFromResponse(response: Response) {
  const listed = response.headers.getSetCookie?.() ?? [];
  if (listed.length) return listed;
  const found: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") found.push(value);
  });
  if (found.length) return found;
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

async function rentrySession() {
  const response = await fetch(RENTRY, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  const html = await response.text();
  const setCookies = cookiesFromResponse(response);
  const cookieToken = csrfFrom(setCookies);
  const formToken = csrfFromHtml(html);
  const csrf = formToken || cookieToken;
  if (!csrf) throw new Error("rentry oturum yok");
  const cookie = cookieHeader(setCookies) || `csrftoken=${cookieToken || csrf}`;
  return { cookie, csrf };
}

async function rentryPost(path: string, fields: Record<string, string>) {
  const session = await rentrySession();
  const body = new URLSearchParams({ csrfmiddlewaretoken: session.csrf, ...fields });
  const response = await fetch(`${RENTRY}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: session.cookie,
      referer: RENTRY,
      "user-agent": USER_AGENT,
      "x-csrftoken": session.csrf,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as { status?: string | number; content?: string };
  } catch {
    return { status: String(response.status), content: text.slice(0, 180) };
  }
}

function unescapeHtml(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cleanExtract(value: string) {
  return unescapeHtml(value.replace(/<[^>]+>/g, "")).replace(/\s+/g, "");
}

export function extractRentryPayload(html: string) {
  const clippy = html.match(/class="[^"]*clippy[^"]*"[^>]*value="([^"]*)"/i) ?? html.match(/value="((?:C1P\.\d+\.)?C1\.[^"]*)"/);
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const fromClippy = clippy?.[1] ? cleanExtract(clippy[1]) : "";
  const fromArticle = article?.[1] ? cleanExtract(article[1]) : "";
  const text = fromArticle.length >= fromClippy.length ? fromArticle : fromClippy;
  const packed = text.match(/C1P\.\d+\.C1\.[A-Za-z0-9+/=]+/);
  if (packed) return packed[0];
  const single = text.match(/C1\.[A-Za-z0-9+/=]+/);
  if (single) return single[0];
  const image = text.match(/I1\.[A-Za-z0-9._+-]+\.[A-Za-z0-9+/=]+/);
  if (image) return image[0];
  const runs = text.match(/[A-Za-z0-9+/=]{32,}/g) ?? [];
  return runs.sort((left, right) => right.length - left.length)[0] ?? text;
}

const RENTRY_PART = 185000;

export function splitBackupPayload(payload: string, size = RENTRY_PART) {
  const parts: string[] = [];
  for (let index = 0; index < payload.length; index += size) {
    parts.push(payload.slice(index, index + size));
  }
  return parts.length ? parts : [payload];
}

export function parseRentryMain(payload: string) {
  const match = payload.match(/^C1P\.(\d+)\.(C1\.[A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { count: Number(match[1]), first: match[2] };
}

export function backupWritePlan(slug: string, parts: string[]) {
  if (parts.length <= 1) return [{ slug, text: parts[0] ?? "" }];
  const writes = parts.slice(1).map((text, index) => ({ slug: `${slug}${index + 1}`, text }));
  writes.push({ slug, text: `C1P.${parts.length}.${parts[0]}` });
  return writes;
}

async function readRemote(slug: string) {
  const response = await fetch(`${RENTRY}/${slug}`, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (/does not exist|not found/i.test(html) && !html.includes("C1.") && !html.includes("C1P.") && !html.includes("I1.")) return null;
  return extractRentryPayload(html);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function mergeById(remote: unknown[] = [], local: unknown[] = []) {
  const map = new Map<string, unknown>();
  for (const item of [...remote, ...local]) {
    const record = asRecord(item);
    if (!record) continue;
    const id = record.id;
    const slug = record.slug;
    const key = typeof slug === "string" && slug ? `slug:${slug}` : typeof id === "number" ? `id:${id}` : `row:${map.size}`;
    map.set(key, item);
  }
  return Array.from(map.values());
}

function mergeNumberIds(remote: number[] = [], local: number[] = []) {
  return Array.from(new Set([...remote, ...local].filter((value) => typeof value === "number")));
}

function mergeStringIds(remote: string[] = [], local: string[] = []) {
  return Array.from(new Set([...remote, ...local].map((value) => value.trim()).filter(Boolean)));
}

function rejectDeleted(items: unknown[], deletedIds: number[], deletedSlugs: string[] = []) {
  const ids = new Set(deletedIds);
  const slugs = new Set(deletedSlugs);
  return items.filter((item) => {
    const record = asRecord(item);
    if (!record) return false;
    if (typeof record.id === "number" && ids.has(record.id)) return false;
    if (typeof record.slug === "string" && slugs.has(record.slug)) return false;
    return true;
  });
}

export function mergeSnapshots(remote: ShopSnapshot | null, local: ShopSnapshot): ShopSnapshot {
  if (!remote) {
    return {
      ...local,
      products: rejectDeleted(local.products, local.deletedProductIds ?? [], local.deletedProductSlugs ?? []),
      reviews: rejectDeleted(local.reviews, local.deletedReviewIds ?? []),
      orders: rejectDeleted(local.orders, local.deletedOrderIds ?? []),
    };
  }
  const deletedProductIds = mergeNumberIds(remote.deletedProductIds, local.deletedProductIds);
  const deletedProductSlugs = mergeStringIds(remote.deletedProductSlugs, local.deletedProductSlugs);
  const deletedReviewIds = mergeNumberIds(remote.deletedReviewIds, local.deletedReviewIds);
  const deletedOrderIds = mergeNumberIds(remote.deletedOrderIds, local.deletedOrderIds);
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    products: rejectDeleted(mergeById(remote.products, local.products), deletedProductIds, deletedProductSlugs),
    reviews: rejectDeleted(mergeById(remote.reviews, local.reviews), deletedReviewIds),
    orders: rejectDeleted(mergeById(remote.orders, local.orders), deletedOrderIds),
    nextReviewId: Math.max(remote.nextReviewId ?? 1, local.nextReviewId ?? 1),
    nextOrderId: Math.max(remote.nextOrderId ?? 1, local.nextOrderId ?? 1),
    nextItemId: Math.max(remote.nextItemId ?? 1, local.nextItemId ?? 1),
    tokens: { ...(remote.tokens ?? {}), ...(local.tokens ?? {}) },
    deletedProductIds,
    deletedProductSlugs,
    deletedReviewIds,
    deletedOrderIds,
  };
}

export function snapshotCount(snapshot: ShopSnapshot | null) {
  if (!snapshot) return 0;
  return (snapshot.products?.length ?? 0) + (snapshot.reviews?.length ?? 0) + (snapshot.orders?.length ?? 0);
}

export function snapshotHasState(snapshot: ShopSnapshot | null) {
  if (!snapshot) return false;
  return snapshotCount(snapshot) > 0
    || (snapshot.deletedProductIds?.length ?? 0) > 0
    || (snapshot.deletedProductSlugs?.length ?? 0) > 0
    || (snapshot.deletedReviewIds?.length ?? 0) > 0
    || (snapshot.deletedOrderIds?.length ?? 0) > 0;
}

export function preparePersistSnapshot(remote: ShopSnapshot | null, local: ShopSnapshot): ShopSnapshot | null {
  if (!remote) return snapshotHasState(local) ? mergeSnapshots(null, local) : null;
  const merged = mergeSnapshots(remote, local);
  return snapshotHasState(merged) ? merged : null;
}

export function encodeShopImage(contentType: string, dataBase64: string) {
  const safe = contentType.toLowerCase().replace(/[^a-z0-9.+-]+/g, "_").replace(/_+/g, "_");
  return `I1.${safe}.${dataBase64.replace(/\s+/g, "")}`;
}

export function decodeShopImage(payload: string) {
  const match = payload.match(/^I1\.([^.\s]+)\.([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { type: match[1].replace("_", "/"), dataBase64: match[2] };
}

export function shopImageId(dataBase64: string) {
  return crypto.createHash("sha256").update(dataBase64).digest("hex").slice(0, 12);
}

export function shopImageUrl(id: string) {
  return `/api/shop-image/${id}`;
}

function forgeConfigured() {
  return Boolean((process.env.BUILT_IN_FORGE_API_URL ?? "").trim() && (process.env.BUILT_IN_FORGE_API_KEY ?? "").trim());
}

async function loadForgeBackup() {
  if (!forgeConfigured()) return null;
  try {
    const url = await storageGetSignedUrl(FORGE_SNAPSHOT_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return decryptSnapshot(await response.text());
  } catch (error) {
    console.error("[shop] depo yedeği okunamadı", error instanceof Error ? error.message : error);
    return null;
  }
}

async function saveForgeBackup(snapshot: ShopSnapshot) {
  if (!forgeConfigured()) return;
  await storagePutStable(FORGE_SNAPSHOT_KEY, encryptSnapshot(snapshot), "text/plain; charset=utf-8");
  console.log("[shop] depo yedeği kaydedildi");
}

async function assembleRentryPayload(main: string, slug: string) {
  const header = parseRentryMain(main);
  if (!header) return main;
  const parts = [header.first];
  for (let index = 1; index < header.count; index += 1) {
    const piece = await readRemote(`${slug}${index}`);
    if (!piece) throw new Error("yedek parça eksik");
    parts.push(piece);
  }
  return parts.join("");
}

async function loadRentryBackup() {
  const { slug } = backupIds();
  try {
    const payload = await readRemote(slug);
    if (!payload) return null;
    return decryptSnapshot(await assembleRentryPayload(payload, slug));
  } catch (error) {
    console.error("[shop] yedek okunamadı", error instanceof Error ? error.message : error);
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeRentry(slug: string, editCode: string, text: string) {
  const edited = await rentryPost(`/api/edit/${slug}`, { edit_code: editCode, text });
  if (String(edited.status) === "200") return;
  const created = await rentryPost("/api/new", { url: slug, edit_code: editCode, text });
  if (String(created.status) === "200") return;
  if (String(created.status) === "429" || String(edited.status) === "429") {
    await delay(1600);
    const retryNew = await rentryPost("/api/new", { url: slug, edit_code: editCode, text });
    if (String(retryNew.status) === "200") return;
    const retryEdit = await rentryPost(`/api/edit/${slug}`, { edit_code: editCode, text });
    if (String(retryEdit.status) === "200") return;
  }
  const retry = await rentryPost(`/api/edit/${slug}`, { edit_code: editCode, text });
  if (String(retry.status) === "200") return;
  throw new Error(created.content || edited.content || "yedek yazılamadı");
}

async function saveRentryBackup(snapshot: ShopSnapshot) {
  const { slug, editCode } = backupIds();
  const parts = splitBackupPayload(encryptSnapshot(snapshot));
  const plan = backupWritePlan(slug, parts);
  for (const step of plan) {
    await writeRentry(step.slug, editCode, step.text);
  }
  console.log(parts.length > 1 ? `[shop] yedek kaydedildi · ${parts.length} parça` : "[shop] yedek kaydedildi");
}

function imageSlug(id: string) {
  return `${backupIds().slug}i${id}`;
}

export async function putShopImage(dataUrl: string) {
  if (dataUrl.startsWith("/api/shop-image/") || dataUrl.startsWith("/shop-image/")) {
    const id = dataUrl.split("/").pop() ?? "";
    return { id, url: shopImageUrl(id) };
  }
  if (!dataUrl.startsWith("data:")) return { id: "", url: dataUrl };
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return { id: "", url: dataUrl };
  const type = match[1].toLowerCase();
  const dataBase64 = match[2].replace(/\s+/g, "");
  const id = shopImageId(dataBase64);
  if (!persistEnabled() || !backupKeyReady()) return { id, url: dataUrl };
  const packed = encodeShopImage(type, dataBase64);
  if (packed.length > RENTRY_PART) return { id, url: dataUrl };
  await writeRentry(imageSlug(id), backupIds().editCode, packed);
  imageCache.set(id, { type, bytes: Buffer.from(dataBase64, "base64") });
  return { id, url: shopImageUrl(id) };
}

export async function getShopImage(id: string) {
  const cached = imageCache.get(id);
  if (cached) return cached;
  const payload = await readRemote(imageSlug(id));
  if (!payload) return null;
  const decoded = decodeShopImage(payload);
  if (!decoded) return null;
  const result = { type: decoded.type, bytes: Buffer.from(decoded.dataBase64, "base64") };
  imageCache.set(id, result);
  return result;
}

async function offloadUrl(url: string) {
  if (!url.startsWith("data:")) return url;
  try {
    return (await putShopImage(url)).url;
  } catch (error) {
    console.error("[shop] görsel ayrılamadı", error instanceof Error ? error.message : error);
    return url;
  }
}

async function offloadSnapshotImages(snapshot: ShopSnapshot): Promise<ShopSnapshot> {
  const products: unknown[] = [];
  for (const product of snapshot.products) {
    const record = asRecord(product);
    if (!record) {
      products.push(product);
      continue;
    }
    const gallery = typeof record.gallery === "string" ? record.gallery : null;
    const imageUrl = typeof record.imageUrl === "string" ? record.imageUrl : null;
    const next: string[] = [];
    for (const url of parseGallery(gallery, imageUrl)) {
      next.push(await offloadUrl(url));
    }
    const packed = packGallery(next);
    products.push({ ...record, imageUrl: packed.imageUrl, gallery: packed.gallery });
  }
  return { ...snapshot, products };
}

export async function loadShopBackup(): Promise<ShopSnapshot | null> {
  if (!persistEnabled() || backupSecret().length < 24) return null;
  const [forge, rentry] = await Promise.all([loadForgeBackup(), loadRentryBackup()]);
  if (forge && rentry) return mergeSnapshots(rentry, forge);
  return forge ?? rentry;
}

export async function saveShopBackup(snapshot: ShopSnapshot) {
  if (!persistEnabled() || backupSecret().length < 24) return;
  if (!snapshotHasState(snapshot)) return;
  let wrote = false;
  if (forgeConfigured()) {
    try {
      await saveForgeBackup(snapshot);
      wrote = true;
    } catch (error) {
      console.error("[shop] depo yedeği yazılamadı", error instanceof Error ? error.message : error);
    }
  }
  try {
    await saveRentryBackup(snapshot);
    wrote = true;
  } catch (error) {
    console.error("[shop] yedek yazılamadı", error instanceof Error ? error.message : error);
  }
  if (!wrote) throw new Error("Yedek alınamadı. Ürünü bir kez daha kaydet.");
  lastBackupFailed = false;
  lastBackup = {
    savedAt: snapshot.savedAt,
    products: snapshot.products.length,
    reviews: snapshot.reviews.length,
    orders: snapshot.orders.length,
  };
}

export function closeShopBackups() {
  backupsOpen = false;
}

export function openShopBackups() {
  backupsOpen = true;
  if (queuedWhileClosed) {
    queuedWhileClosed = false;
    enqueueShopBackup();
  }
}

async function persistMerged() {
  if (!capture) return;
  if (!backupKeyReady()) {
    lastBackupFailed = true;
    console.error("[shop] yedek anahtarı yok");
    return;
  }
  const remote = await loadShopBackup();
  const local = capture();
  const prepared = preparePersistSnapshot(remote, local);
  if (!prepared) return;
  const stored = await offloadSnapshotImages(prepared);
  recover?.(stored);
  await saveShopBackup(stored);
}

function queuePersist() {
  pending = pending
    .then(persistMerged)
    .catch((error) => {
      lastBackupFailed = true;
      console.error("[shop] yedek yazılamadı", error instanceof Error ? error.message : error);
    });
  return pending;
}

export function enqueueShopBackup() {
  if (!persistEnabled() || !capture) return;
  if (!backupsOpen) {
    queuedWhileClosed = true;
    return;
  }
  void queuePersist();
}

export function flushShopBackup() {
  return pending;
}

export async function persistShopNow() {
  if (!persistEnabled()) return;
  backupsOpen = true;
  await queuePersist();
}

export function backupKeyReady() {
  return backupSecret().length >= 24;
}

export function backupStatus() {
  return {
    ready: backupKeyReady(),
    savedAt: lastBackup?.savedAt ?? null,
    products: lastBackup?.products ?? 0,
    reviews: lastBackup?.reviews ?? 0,
    orders: lastBackup?.orders ?? 0,
    failed: lastBackupFailed,
  };
}
