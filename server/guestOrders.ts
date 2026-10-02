import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { GUEST_ORDERS_COOKIE, GUEST_ORDERS_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { cookieSecretKey } from "./_core/secrets";

function cookieMap(header: string | undefined) {
  if (!header) return new Map<string, string>();
  return new Map(Object.entries(parseCookieHeader(header)));
}

export async function readGuestOrderNumbers(req: Pick<Request, "headers">) {
  const token = cookieMap(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined).get(GUEST_ORDERS_COOKIE);
  if (!token) return [] as string[];
  try {
    const { payload } = await jwtVerify(token, cookieSecretKey(), { algorithms: ["HS256"] });
    const orders = (payload as { orders?: unknown }).orders;
    if (!Array.isArray(orders)) return [];
    return orders.filter((value): value is string => typeof value === "string" && value.length > 3).slice(0, 30);
  } catch {
    return [];
  }
}

export async function rememberGuestOrder(
  req: Request,
  res: Pick<Response, "cookie">,
  orderNumber: string,
) {
  if (!orderNumber || typeof res.cookie !== "function") return;
  const orders = [orderNumber, ...(await readGuestOrderNumbers(req)).filter((value) => value !== orderNumber)].slice(0, 30);
  const token = await new SignJWT({ orders })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + GUEST_ORDERS_MS) / 1000))
    .sign(cookieSecretKey());
  res.cookie(GUEST_ORDERS_COOKIE, token, { ...getSessionCookieOptions(req), maxAge: GUEST_ORDERS_MS });
}

export function phoneKey(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export function phonesMatch(left: string, right: string) {
  const a = phoneKey(left);
  const b = phoneKey(right);
  return a.length >= 10 && a === b;
}
