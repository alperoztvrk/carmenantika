import { describe, expect, it } from "vitest";
import { reconcileCart, type CartLine } from "./CartContext";

function line(id: number, name = `Parça ${id}`): CartLine {
  return {
    id,
    slug: `parca-${id}`,
    name,
    priceCents: 1000,
    imageUrl: `/photos/${id}.jpg`,
    shortDescription: "kısa",
    expiresAt: Date.now() + 60_000,
  };
}

describe("reconcileCart", () => {
  it("drops a product that was deleted from the catalog", () => {
    const items = [line(1, "Radyo"), line(2, "Kamera")];
    const result = reconcileCart(items, [{ ...line(2), isAvailable: 1 }], false);
    expect(result.removed.map((item) => item.name)).toEqual(["Radyo"]);
    expect(result.items.map((item) => item.id)).toEqual([2]);
  });

  it("drops a product that is no longer for sale", () => {
    const items = [line(1)];
    const result = reconcileCart(items, [{ ...line(1), isAvailable: 0 }], false);
    expect(result.removed).toHaveLength(1);
    expect(result.items).toEqual([]);
  });

  it("keeps a held product when the shopper just cancelled payment", () => {
    const items = [line(1)];
    const result = reconcileCart(items, [{ ...line(1), isAvailable: 0 }], true);
    expect(result.removed).toEqual([]);
    expect(result.items).toHaveLength(1);
  });

  it("refreshes the price when the catalog changes", () => {
    const items = [line(1)];
    const result = reconcileCart(items, [{ ...line(1), isAvailable: 1, priceCents: 2500, name: "Yeni ad" }], false);
    expect(result.removed).toEqual([]);
    expect(result.items[0]?.priceCents).toBe(2500);
    expect(result.items[0]?.name).toBe("Yeni ad");
    expect(result.items[0]?.expiresAt).toBe(items[0].expiresAt);
  });

  it("returns the same list when nothing changed", () => {
    const items = [line(1)];
    const result = reconcileCart(items, [{ ...items[0], isAvailable: 1 }], false);
    expect(result.items).toBe(items);
  });
});
