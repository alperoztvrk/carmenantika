export function filterCatalog<T extends { category: string }>(items: T[], filter: string) {
  return filter === "Tümü" ? items : items.filter((item) => item.category === filter);
}
