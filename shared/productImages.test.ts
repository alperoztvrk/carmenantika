import { describe, expect, it } from "vitest";
import { packGallery, parseGallery } from "./productImages";

describe("product gallery", () => {
  it("keeps the cover image first and drops duplicates", () => {
    const packed = packGallery([" /a.jpg ", "/b.jpg", "/a.jpg", ""]);
    expect(packed.imageUrl).toBe("/a.jpg");
    expect(JSON.parse(packed.gallery)).toEqual(["/a.jpg", "/b.jpg"]);
    expect(parseGallery(packed.gallery, packed.imageUrl)).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("falls back to the cover when gallery json is missing", () => {
    expect(parseGallery(null, "/cover.jpg")).toEqual(["/cover.jpg"]);
    expect(parseGallery("not-json", "/cover.jpg")).toEqual(["/cover.jpg"]);
  });
});
