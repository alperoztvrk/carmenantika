import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { findLocalProductById } from "./localCatalog";

const adminUser: User = {
  id: 1,
  openId: "local-admin",
  name: "Carmen",
  email: null,
  loginMethod: "local",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function caller(user: User | null = adminUser) {
  const ctx: TrpcContext = {
    user,
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

describe("product editor", () => {
  it("saves only name, category, price, description and multiple images", async () => {
    const admin = caller();
    const created = await admin.product.adminCreate({
      name: "Cam Vazo",
      category: "Vazolar",
      priceCents: 175000,
      description: "Küçük yeşil cam vazo.",
      imageUrls: ["/photos/frames.jpg", "/photos/story-market.jpg"],
    });
    expect(created?.name).toBe("Cam Vazo");
    expect(created?.category).toBe("Vazolar");
    expect(created?.era).toBe("");
    expect(created?.condition).toBe("");
    expect(created?.tag).toBeNull();
    expect(created?.isFeatured).toBe(0);
    expect(created?.imageUrl).toBe("/photos/frames.jpg");
    expect(created?.imageUrls).toEqual(["/photos/frames.jpg", "/photos/story-market.jpg"]);

    const listed = await caller(null).product.list();
    const publicProduct = listed.find((item) => item.id === created?.id);
    expect(publicProduct?.imageUrls).toEqual(["/photos/frames.jpg", "/photos/story-market.jpg"]);
    expect(publicProduct?.description).toBe("Küçük yeşil cam vazo.");

    const updated = await admin.product.adminUpdate({
      id: created!.id,
      data: { category: "Cam", imageUrls: ["/photos/radio.jpg"] },
    });
    expect(updated?.category).toBe("Cam");
    expect(updated?.imageUrls).toEqual(["/photos/radio.jpg"]);
    expect(findLocalProductById(created!.id)?.gallery).toBe(JSON.stringify(["/photos/radio.jpg"]));
  });
});
