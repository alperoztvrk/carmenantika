import crypto from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
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
};

const USER_AGENT = "carmen-antika/1.0";
const RENTRY = "https://rentry.co";
const FORGE_SNAPSHOT_KEY = "carmen-antika/shop/v1.snapshot";

let capture: (() => ShopSnapshot) | null = null;
let pending: Promise<void> = Promise.resolve();
let backupsOpen = false;
let queuedWhileClosed = false;

export function bindShopBackup(fn: () => ShopSnapshot) {
  capture = fn;
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
    const match = cookie.match(/^csrftoken=([^;]+)/i);
    if (match?.[1]) return match[1];
  }
  return "";
}

async function rentrySession() {
  const response = await fetch(RENTRY, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const csrf = csrfFrom(setCookies);
  if (!csrf) throw new Error("rentry csrf yok");
  return { cookie: cookieHeader(setCookies), csrf };
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

function extractRentryPayload(html: string) {
  const clippy = html.match(/class="clippy"[^>]*value="([^"]*)"/i) ?? html.match(/value="(C1\.[^"]*)"/);
  if (clippy?.[1]) return unescapeHtml(clippy[1]).trim();
  const article = html.match(/<article>([\s\S]*?)<\/article>/i);
  if (!article) return "";
  const text = unescapeHtml(article[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const token = text.match(/C1\.[A-Za-z0-9+/=]+/);
  return token?.[0] ?? text;
}

async function readRemote(slug: string) {
  const response = await fetch(`${RENTRY}/${slug}`, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (/does not exist|not found/i.test(html) && !html.includes("C1.")) return null;
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
    const key = typeof id === "number" ? `id:${id}` : typeof slug === "string" && slug ? `slug:${slug}` : `row:${map.size}`;
    map.set(key, item);
  }
  return Array.from(map.values());
}

export function mergeSnapshots(remote: ShopSnapshot | null, local: ShopSnapshot): ShopSnapshot {
  if (!remote) return local;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    products: mergeById(remote.products, local.products),
    reviews: mergeById(remote.reviews, local.reviews),
    orders: mergeById(remote.orders, local.orders),
    nextReviewId: Math.max(remote.nextReviewId ?? 1, local.nextReviewId ?? 1),
    nextOrderId: Math.max(remote.nextOrderId ?? 1, local.nextOrderId ?? 1),
    nextItemId: Math.max(remote.nextItemId ?? 1, local.nextItemId ?? 1),
    tokens: { ...(remote.tokens ?? {}), ...(local.tokens ?? {}) },
  };
}

async function loadForgeBackup() {
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
  await storagePutStable(FORGE_SNAPSHOT_KEY, encryptSnapshot(snapshot), "text/plain; charset=utf-8");
  console.log("[shop] depo yedeği kaydedildi");
}

async function loadRentryBackup() {
  const { slug } = backupIds();
  try {
    const payload = await readRemote(slug);
    if (!payload) return null;
    return decryptSnapshot(payload);
  } catch (error) {
    console.error("[shop] yedek okunamadı", error instanceof Error ? error.message : error);
    return null;
  }
}

async function saveRentryBackup(snapshot: ShopSnapshot) {
  const { slug, editCode } = backupIds();
  const payload = encryptSnapshot(snapshot);
  const edited = await rentryPost(`/api/edit/${slug}`, { edit_code: editCode, text: payload });
  if (String(edited.status) === "200") {
    console.log("[shop] yedek kaydedildi");
    return;
  }
  const created = await rentryPost("/api/new", { url: slug, edit_code: editCode, text: payload });
  if (String(created.status) === "200") {
    console.log("[shop] yedek oluşturuldu");
    return;
  }
  const retry = await rentryPost(`/api/edit/${slug}`, { edit_code: editCode, text: payload });
  if (String(retry.status) === "200") {
    console.log("[shop] yedek kaydedildi");
    return;
  }
  throw new Error(created.content || edited.content || "yedek yazılamadı");
}

export async function loadShopBackup(): Promise<ShopSnapshot | null> {
  if (!persistEnabled() || backupSecret().length < 24) return null;
  const [forge, rentry] = await Promise.all([loadForgeBackup(), loadRentryBackup()]);
  if (forge && rentry) return mergeSnapshots(rentry, forge);
  return forge ?? rentry;
}

export async function saveShopBackup(snapshot: ShopSnapshot) {
  if (!persistEnabled() || backupSecret().length < 24) return;
  const errors: string[] = [];
  try {
    await saveForgeBackup(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop] depo yedeği yazılamadı", message);
    errors.push(message);
  }
  try {
    await saveRentryBackup(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop] yedek yazılamadı", message);
    errors.push(message);
  }
  if (errors.length === 2) throw new Error(errors.join(" · "));
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

export function enqueueShopBackup() {
  if (!persistEnabled() || !capture) return;
  if (!backupsOpen) {
    queuedWhileClosed = true;
    return;
  }
  const snapshot = capture();
  pending = pending
    .then(() => saveShopBackup(snapshot))
    .catch((error) => {
      console.error("[shop] yedek yazılamadı", error instanceof Error ? error.message : error);
    });
}

export function flushShopBackup() {
  return pending;
}

export function backupKeyReady() {
  return backupSecret().length >= 24;
}
