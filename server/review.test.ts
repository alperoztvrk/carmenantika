import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { resetReviewsForTests } from "./localReviews";
import type { TrpcContext } from "./_core/context";

function caller() {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "http",
      headers: { host: "localhost:3000" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

afterEach(() => {
  resetReviewsForTests();
});

describe("shop reviews", () => {
  it("lists seeded notes and publishes a new one", async () => {
    const listed = await caller().review.list();
    expect(listed.length).toBeGreaterThanOrEqual(4);
    const created = await caller().review.create({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      rating: 5,
      body: "Parça evimde çok güzel duruyor, teslimat da özenliydi.",
    });
    expect(created.firstName).toBe("Ayşe");
    const after = await caller().review.list();
    expect(after[0]?.body).toMatch(/evimde/);
  });

  it("rejects a short comment and strips markup", async () => {
    await expect(caller().review.create({
      firstName: "A",
      lastName: "Yılmaz",
      rating: 5,
      body: "çok kısa",
    })).rejects.toThrow(/Ad ve soyad|uzun/);
    const created = await caller().review.create({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      rating: 4,
      body: "<b>Parça</b> evde duruşuyla tam beklediğim gibi oldu.",
    });
    expect(created.body).not.toContain("<b>");
  });
});
