import { iyzicoConfigured, iyzicoIsSandbox } from "./iyzico";

export function liveConfigProblems() {
  const problems: string[] = [];
  const password = (process.env.LOCAL_ADMIN_PASSWORD ?? "").trim();
  const jwt = (process.env.JWT_SECRET ?? "").trim();
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/$/, "");
  if (!password || password.toLowerCase() === "carmen") {
    problems.push("LOCAL_ADMIN_PASSWORD canlıda zorunlu ve carmen olamaz.");
  }
  if (jwt.length < 24) {
    problems.push("JWT_SECRET en az 24 karakter olmalı. openssl rand -hex 32");
  }
  if (!/^https:\/\/[^/]+/i.test(site)) {
    problems.push("SITE_URL https://senin-domainin.com olmalı.");
  }
  if (!iyzicoConfigured()) {
    problems.push("IYZICO_API_KEY ve IYZICO_SECRET_KEY boş.");
  } else if (iyzicoIsSandbox()) {
    problems.push("iyzico anahtarı sandbox-. Canlı için merchant.iyzipay.com anahtarlarını yaz.");
  }
  return problems;
}

export function assertLiveConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const problems = liveConfigProblems();
  if (problems.length === 0) {
    console.log("[canlı] iyzico canlı API, yönetim şifresi ve SITE_URL hazır.");
    return;
  }
  console.error("[canlı] Site canlıya çıkamaz:");
  for (const problem of problems) console.error(`  - ${problem}`);
  throw new Error(problems.join(" "));
}
