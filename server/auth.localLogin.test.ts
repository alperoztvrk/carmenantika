import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

const saved = {
  nodeEnv: process.env.NODE_ENV,
  password: process.env.LOCAL_ADMIN_PASSWORD,
  jwt: process.env.JWT_SECRET,
};

afterEach(() => {
  if (saved.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved.nodeEnv;
  if (saved.password === undefined) delete process.env.LOCAL_ADMIN_PASSWORD;
  else process.env.LOCAL_ADMIN_PASSWORD = saved.password;
  if (saved.jwt === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = saved.jwt;
});

function caller() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      hostname: "carmenantika.com",
      headers: { host: "carmenantika.com" },
      ip: "85.34.78.112",
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
  return { caller: appRouter.createCaller(ctx), cookies };
}

describe("auth.localLogin", () => {
  it("stays open in development with the local password", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.LOCAL_ADMIN_PASSWORD;
    const status = await caller().caller.auth.localStatus();
    expect(status).toEqual({ enabled: true, live: false, passwordHint: "carmen" });
    const { caller: api, cookies } = caller();
    await expect(api.auth.localLogin({ password: "carmen" })).resolves.toEqual({ success: true });
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.options).not.toHaveProperty("maxAge");
    expect(cookies[0]?.options).toMatchObject({ sameSite: "lax", httpOnly: true });
  });

  it("is closed in production until LOCAL_ADMIN_PASSWORD is set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.LOCAL_ADMIN_PASSWORD;
    const status = await caller().caller.auth.localStatus();
    expect(status).toEqual({ enabled: false, live: true, passwordHint: null });
    await expect(caller().caller.auth.localLogin({ password: "carmen" })).rejects.toThrow(/LOCAL_ADMIN_PASSWORD/);
  });

  it("accepts the production password and never shows a hint", async () => {
    process.env.NODE_ENV = "production";
    process.env.LOCAL_ADMIN_PASSWORD = "dükkan-gizli";
    process.env.JWT_SECRET = "test-jwt-secret-please-change";
    const status = await caller().caller.auth.localStatus();
    expect(status).toEqual({ enabled: true, live: true, passwordHint: null });
    const { caller: api, cookies } = caller();
    await expect(api.auth.localLogin({ password: "wrong" })).rejects.toThrow(/Şifre yanlış/);
    await expect(api.auth.localLogin({ password: "dükkan-gizli" })).resolves.toEqual({ success: true });
    expect(cookies[0]?.options).not.toHaveProperty("maxAge");
    expect(cookies[0]?.options).toMatchObject({ sameSite: "lax", secure: true });
  });
});
