import { describe, expect, it } from "vitest";
import { backupWritePlan, csrfFromHtml, decodeShopImage, decryptSnapshot, encodeShopImage, encryptSnapshot, extractRentryPayload, mergeSnapshots, parseRentryMain, preparePersistSnapshot, splitBackupPayload, type ShopSnapshot } from "./shopRemote";
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

  it("reassembles a wrapped snapshot and split rentry parts", () => {
    const packed = encryptSnapshot(snapshot, secret);
    const html = `<article><div><p>${packed.slice(0, 40)}</p><p>${packed.slice(40)}</p></div></article>`;
    expect(extractRentryPayload(html)).toBe(packed);
    expect(decryptSnapshot(extractRentryPayload(html), secret)?.products).toEqual(snapshot.products);

    const parts = splitBackupPayload(packed, 40);
    expect(parts.length).toBeGreaterThan(1);
    const main = `C1P.${parts.length}.${parts[0]}`;
    const parsed = parseRentryMain(main);
    expect(parsed?.count).toBe(parts.length);
    expect(parsed?.first).toBe(parts[0]);
    expect(decryptSnapshot([parsed!.first, ...parts.slice(1)].join(""), secret)?.reviews).toEqual(snapshot.reviews);
    expect(extractRentryPayload(`<article><p>${main.slice(0, 20)}</p><span>${main.slice(20)}</span></article>`)).toBe(main);
    expect(extractRentryPayload(`<article><p>${parts[1].slice(0, 12)}</p><p>${parts[1].slice(12)}</p></article>`)).toBe(parts[1]);
  });

  it("does not revive a product or review after it was deleted", () => {
    const remote: ShopSnapshot = {
      ...snapshot,
      products: [
        { id: 1, slug: "cam-vazo", name: "Cam Vazo" },
        { id: 2, slug: "radyo", name: "Radyo" },
      ],
      reviews: [{ id: 9, body: "Paketleme çok iyi" }, { id: 10, body: "Kalmasın" }],
    };
    const local: ShopSnapshot = {
      ...snapshot,
      products: [{ id: 2, slug: "radyo", name: "Radyo" }],
      reviews: [{ id: 9, body: "Paketleme çok iyi" }],
      deletedProductIds: [1],
      deletedProductSlugs: ["cam-vazo"],
      deletedReviewIds: [10],
    };
    const prepared = preparePersistSnapshot(remote, local);
    expect(prepared?.products).toEqual([{ id: 2, slug: "radyo", name: "Radyo" }]);
    expect(prepared?.reviews).toEqual([{ id: 9, body: "Paketleme çok iyi" }]);
    expect(prepared?.deletedProductIds).toEqual([1]);
    expect(prepared?.deletedReviewIds).toEqual([10]);
  });

  it("keeps the first product and reviews when a second instance only has the new product", () => {
    const remote: ShopSnapshot = {
      ...snapshot,
      products: [{ id: 1, slug: "cam-vazo", name: "Cam Vazo" }],
      reviews: [{ id: 9, body: "Paketleme çok iyi" }],
      nextReviewId: 10,
    };
    const local: ShopSnapshot = {
      ...snapshot,
      products: [{ id: 1, slug: "radyo", name: "Radyo" }],
      reviews: [],
      nextReviewId: 1,
    };
    const prepared = preparePersistSnapshot(remote, local);
    expect(prepared?.products.map((product) => (product as { slug: string }).slug).sort()).toEqual(["cam-vazo", "radyo"]);
    expect(prepared?.reviews).toEqual([{ id: 9, body: "Paketleme çok iyi" }]);
    expect(preparePersistSnapshot(null, { ...snapshot, products: [], reviews: [], orders: [] })).toBeNull();
  });

  it("writes extra rentry parts before replacing the main snapshot", () => {
    const plan = backupWritePlan("caslug", ["C1.aaa", "bbb", "ccc"]);
    expect(plan.map((step) => step.slug)).toEqual(["caslug1", "caslug2", "caslug"]);
    expect(plan[2]?.text.startsWith("C1P.3.C1.aaa")).toBe(true);
  });

  it("round-trips a shop image payload through wrapped html", () => {
    const packed = encodeShopImage("image/jpeg", "abcDEF123+/=");
    expect(decodeShopImage(packed)).toEqual({ type: "image/jpeg", dataBase64: "abcDEF123+/=" });
    expect(extractRentryPayload(`<article><p>${packed.slice(0, 12)}</p><p>${packed.slice(12)}</p></article>`)).toBe(packed);
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
