import { describe, expect, it } from "vitest";
import { csrfFromHtml, decryptSnapshot, encryptSnapshot, mergeSnapshots, type ShopSnapshot } from "./shopRemote";
import { DUMMY_PRODUCT_SLUGS, importLocalProducts, readLocalProducts, resetCatalogForTests } from "./localCatalog";

const secret = "shop-backup-secret-key-24chars";

const snapshot: ShopSnapshot = {
  version: 1,
  savedAt: "2026-10-13T12:00:00.000Z",
  products: [{ id: 1, slug: "cam-vazo", name: "Cam Vazo" }],
  reviews: [{ id: 1, body: "Güzel duruyor." }],
  orders: [],
  nextReviewId: 2,
  nextOrderId: 1,
  nextItemId: 1,
  tokens: {},
};

describe("shop backup", () => {
  it("round-trips an encrypted snapshot", () => {
    const packed = encryptSnapshot(snapshot, secret);
    expect(packed.startsWith("C1.")).toBe(true);
    expect(decryptSnapshot(packed, secret)).toMatchObject({
      version: 1,
      products: [{ slug: "cam-vazo" }],
      reviews: [{ body: "Güzel duruyor." }],
    });
    expect(decryptSnapshot(packed, "wrong-secret-key-24-characters!")).toBeNull();
  });

  it("drops dummy catalog pieces on import", () => {
    resetCatalogForTests();
    importLocalProducts([
      { id: 9001, slug: "national-cep-radyosu", name: "National Cep Radyosu" } as never,
      { id: 12, slug: "cam-vazo", name: "Cam Vazo", createdAt: new Date(), updatedAt: new Date() } as never,
    ], false);
    expect(DUMMY_PRODUCT_SLUGS.has("national-cep-radyosu")).toBe(true);
    expect(readLocalProducts(true).map((product) => product.slug)).toEqual(["cam-vazo"]);
  });

  it("keeps remote products and new local reviews when merging", () => {
    const remote: ShopSnapshot = {
      ...snapshot,
      products: [{ id: 12, slug: "cam-vazo", name: "Cam Vazo" }],
      reviews: [{ id: 1, body: "İlk yorum" }],
      nextReviewId: 2,
    };
    const local: ShopSnapshot = {
      ...snapshot,
      products: [],
      reviews: [{ id: 2, body: "Arkadaş yorumu" }],
      nextReviewId: 3,
    };
    const merged = mergeSnapshots(remote, local);
    expect(merged.products).toEqual([{ id: 12, slug: "cam-vazo", name: "Cam Vazo" }]);
    expect(merged.reviews.map((review) => (review as { body: string }).body)).toEqual(["İlk yorum", "Arkadaş yorumu"]);
    expect(merged.nextReviewId).toBe(3);
  });

  it("reads csrf from rentry html when set-cookie is missing", () => {
    expect(csrfFromHtml('<input type="hidden" name="csrfmiddlewaretoken" value="abc123">')).toBe("abc123");
  });

  it("does not replace a catalog with an empty snapshot", () => {
    const empty: ShopSnapshot = {
      version: 1,
      savedAt: "2026-10-13T12:00:00.000Z",
      products: [],
      reviews: [],
      orders: [],
      nextReviewId: 1,
      nextOrderId: 1,
      nextItemId: 1,
      tokens: {},
    };
    expect(mergeSnapshots(snapshot, empty).products).toEqual(snapshot.products);
    expect(mergeSnapshots(snapshot, empty).reviews).toEqual(snapshot.reviews);
  });
});
