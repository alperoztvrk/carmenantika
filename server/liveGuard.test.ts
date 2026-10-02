import { afterEach, describe, expect, it } from "vitest";
import { liveConfigProblems } from "./liveGuard";

const saved = { ...process.env };

afterEach(() => {
  for (const key of ["LOCAL_ADMIN_PASSWORD", "JWT_SECRET", "SITE_URL", "IYZICO_API_KEY", "IYZICO_SECRET_KEY"]) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("liveConfigProblems", () => {
  it("lists every missing live setting", () => {
    process.env.LOCAL_ADMIN_PASSWORD = "carmen";
    process.env.JWT_SECRET = "short";
    process.env.SITE_URL = "http://localhost:3000";
    delete process.env.IYZICO_API_KEY;
    delete process.env.IYZICO_SECRET_KEY;
    const problems = liveConfigProblems();
    expect(problems.some((item) => /LOCAL_ADMIN_PASSWORD/.test(item))).toBe(true);
    expect(problems.some((item) => /JWT_SECRET/.test(item))).toBe(true);
    expect(problems.some((item) => /SITE_URL/.test(item))).toBe(true);
    expect(problems.some((item) => /IYZICO/.test(item))).toBe(true);
  });

  it("accepts live iyzico keys and https", () => {
    process.env.LOCAL_ADMIN_PASSWORD = "guclu-sifre-123";
    process.env.JWT_SECRET = "abcdefghijklmnopqrstuvwxyz012345";
    process.env.SITE_URL = "https://carmenantika.com";
    process.env.IYZICO_API_KEY = "live-merchant-key";
    process.env.IYZICO_SECRET_KEY = "live-merchant-secret";
    expect(liveConfigProblems()).toEqual([]);
  });

  it("rejects sandbox iyzico keys", () => {
    process.env.LOCAL_ADMIN_PASSWORD = "guclu-sifre-123";
    process.env.JWT_SECRET = "abcdefghijklmnopqrstuvwxyz012345";
    process.env.SITE_URL = "https://carmenantika.com";
    process.env.IYZICO_API_KEY = "sandbox-abc";
    process.env.IYZICO_SECRET_KEY = "sandbox-def";
    expect(liveConfigProblems().some((item) => /sandbox/i.test(item))).toBe(true);
  });
});
