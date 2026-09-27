import { describe, expect, it } from "vitest";
import { filterCatalog } from "./catalog";

describe("filterCatalog", () => {
  const items = [
    { category: "Mobilya", name: "Sehpa" },
    { category: "Objeler", name: "Vazo" },
    { category: "Mobilya", name: "Berjer" },
  ];

  it("returns the complete catalog for the Tümü filter", () => {
    expect(filterCatalog(items, "Tümü")).toHaveLength(3);
  });

  it("returns only items in the selected category", () => {
    expect(filterCatalog(items, "Mobilya").map((item) => item.name)).toEqual(["Sehpa", "Berjer"]);
  });
});
