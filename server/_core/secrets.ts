import crypto from "node:crypto";

let generatedSecret = "";

export function cookieSecretKey() {
  const fromEnv = (process.env.JWT_SECRET ?? "").trim();
  if (fromEnv) return new TextEncoder().encode(fromEnv);
  if (process.env.NODE_ENV !== "production") return new TextEncoder().encode("carmen-local-dev-secret");
  if (!generatedSecret) {
    generatedSecret = crypto.randomBytes(32).toString("hex");
    console.warn("[Auth] JWT_SECRET yok; bu açılış için geçici bir anahtar üretildi. Canlı sitede .env içine JWT_SECRET ekle.");
  }
  return new TextEncoder().encode(generatedSecret);
}
