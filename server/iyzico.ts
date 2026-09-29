import crypto from "node:crypto";
import dotenv from "dotenv";

const INITIALIZE_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

export type IyzicoCheckoutItem = {
  id: number;
  name: string;
  category: string;
  priceCents: number;
};

export type IyzicoCheckoutInput = {
  orderNumber: string;
  callbackUrl: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  ip: string;
  items: IyzicoCheckoutItem[];
};

export type IyzicoPayment = {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  paymentPageUrl?: string;
  payWithIyzicoPageUrl?: string;
  token?: string;
  paymentStatus?: string;
  paymentId?: string;
  conversationId?: string;
  basketId?: string;
};

export class IyzicoRequestError extends Error {
  errorCode?: string;
}

type HeaderBag = Record<string, string | string[] | undefined>;

function cleanKey(value: string) {
  let key = value.replace(/^\uFEFF/, "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  key = key.replace(/\s+/g, "");
  const sandboxAt = key.toLowerCase().indexOf("sandbox-");
  if (sandboxAt > 0) key = key.slice(sandboxAt);
  return key;
}

export function iyzicoConfig() {
  if (process.env.NODE_ENV === "development") dotenv.config({ override: true, quiet: true });
  const apiKey = cleanKey(process.env.IYZICO_API_KEY ?? "");
  const secretKey = cleanKey(process.env.IYZICO_SECRET_KEY ?? "");
  const sandbox = apiKey.toLowerCase().startsWith("sandbox-");
  const baseUrl = apiKey ? (sandbox ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com") : "https://sandbox-api.iyzipay.com";
  return { apiKey, secretKey, baseUrl };
}

export function iyzicoStatusLine() {
  const { apiKey, secretKey, baseUrl } = iyzicoConfig();
  if (!apiKey || !secretKey) return "IYZICO_API_KEY veya IYZICO_SECRET_KEY boş.";
  const kind = apiKey.toLowerCase().startsWith("sandbox-") ? "sandbox- ile başlıyor" : "sandbox- ile başlamıyor";
  return `API anahtarı ${kind}, ${apiKey.length} karakter. Güvenlik anahtarı ${secretKey.length} karakter. Adres ${baseUrl}.`;
}

export function iyzicoConfigured() {
  const { apiKey, secretKey } = iyzicoConfig();
  return Boolean(apiKey && secretKey);
}

export function lira(cents: number) {
  return (cents / 100).toFixed(2);
}

export function publicOrigin(req: { protocol?: string; headers: HeaderBag }) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : req.protocol) || "http";
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = req.headers.host;
  const host = (typeof forwardedHost === "string" ? forwardedHost.split(",")[0].trim() : typeof hostHeader === "string" ? hostHeader : "") || "localhost:3000";
  return `${proto}://${host}`;
}

export function buyerIp(req: { ip?: string; headers: HeaderBag; socket?: { remoteAddress?: string | null } }) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = (typeof forwarded === "string" ? forwarded.split(",")[0] : req.ip || req.socket?.remoteAddress || "").trim();
  const ip = raw.replace(/^::ffff:/, "");
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) {
    return "85.34.78.112";
  }
  return ip;
}

function gsmNumber(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return { gsm: `+90${digits}`, digits };
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { name: "Misafir", surname: "Misafir" };
  if (parts.length === 1) return { name: parts[0], surname: parts[0] };
  return { name: parts[0], surname: parts.slice(1).join(" ") };
}

export function hostedCheckoutUrl(token: string, baseUrl: string) {
  const page = baseUrl.includes("sandbox") ? "https://sandbox-cpp.iyzipay.com" : "https://cpp.iyzipay.com";
  return `${page}?token=${encodeURIComponent(token)}&lang=tr`;
}

function httpUrl(value: string | undefined) {
  return value && /^https?:\/\//i.test(value) ? value : "";
}

function stamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function iyzicoRequest(path: string, body: Record<string, unknown>) {
  const { apiKey, secretKey, baseUrl } = iyzicoConfig();
  if (!apiKey || !secretKey) throw new Error("iyzico anahtarı yok");
  const payload = JSON.stringify(body);
  const randomKey = `${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
  const signature = crypto.createHmac("sha256", secretKey).update(randomKey + path + payload).digest("hex");
  const authorization = `IYZWSv2 ${Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString("base64")}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: payload,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json().catch(() => null)) as IyzicoPayment | null;
  if (!data || data.status !== "success") {
    const failure = new IyzicoRequestError(data?.errorMessage || `iyzico yanıtı alınamadı (${response.status})`);
    failure.errorCode = data?.errorCode;
    throw failure;
  }
  return data;
}

export async function initializeCheckout(input: IyzicoCheckoutInput) {
  const totalCents = input.items.reduce((sum, item) => sum + item.priceCents, 0);
  const price = lira(totalCents);
  const { name, surname } = splitName(input.customerName);
  const { gsm, digits } = gsmNumber(input.customerPhone);
  const address = input.shippingAddress.trim().slice(0, 200);
  const now = stamp();
  const buyer = {
    id: input.orderNumber,
    name: name.slice(0, 50),
    surname: surname.slice(0, 50),
    gsmNumber: gsm,
    email: `musteri.${digits || "0"}@siparis.carmenantika.com`,
    identityNumber: "11111111111",
    lastLoginDate: now,
    registrationDate: now,
    registrationAddress: address,
    ip: input.ip,
    city: "Antalya",
    country: "Turkey",
    zipCode: "07000",
  };
  const shipping = { contactName: input.customerName.trim().slice(0, 100), city: "Antalya", country: "Turkey", address, zipCode: "07000" };
  const data = await iyzicoRequest(INITIALIZE_PATH, {
    locale: "tr",
    conversationId: input.orderNumber,
    price,
    paidPrice: price,
    currency: "TRY",
    basketId: input.orderNumber,
    paymentGroup: "PRODUCT",
    callbackUrl: input.callbackUrl,
    buyer,
    shippingAddress: shipping,
    billingAddress: shipping,
    basketItems: input.items.map((item) => ({
      id: String(item.id),
      name: item.name.slice(0, 120),
      category1: (item.category || "Objeler").slice(0, 80),
      itemType: "PHYSICAL",
      price: lira(item.priceCents),
    })),
  });
  const { baseUrl } = iyzicoConfig();
  const url = httpUrl(data.paymentPageUrl) || httpUrl(data.payWithIyzicoPageUrl) || (data.token ? hostedCheckoutUrl(data.token, baseUrl) : "");
  if (!url) throw new Error("iyzico ödeme sayfası dönmedi");
  console.log("[iyzico] ödeme sayfası hazır", input.orderNumber);
  return { url, token: data.token ?? "" };
}

export async function retrieveCheckout(token: string, conversationId: string) {
  const body: Record<string, unknown> = { locale: "tr", token };
  if (conversationId) body.conversationId = conversationId;
  return iyzicoRequest(RETRIEVE_PATH, body);
}
