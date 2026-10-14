import fs from "node:fs";
import path from "node:path";
import type { InsertProduct, Product } from "../drizzle/schema";
import { dataFile } from "./dataFile";
import { enqueueShopBackup } from "./shopRemote";

export const DUMMY_PRODUCT_SLUGS = new Set([
  "national-cep-radyosu",
  "ansco-kutu-kamera",
  "polaroid-aninda",
  "kurmali-oyuncak-secisi",
  "cam-golgeler",
  "seyahat-daktilosu",
  "radyo-tezgahi",
  "secilmis-vazolar",
]);

const memoryProducts: Product[] = [];
const persistPath = dataFile("carmen-catalog.json");
const persistEnabled = process.env.NODE_ENV !== "test";
let catalogLoaded = false;

function isDummyProduct(product: { slug?: string; id?: number; name?: string }) {
  if (product.slug && DUMMY_PRODUCT_SLUGS.has(product.slug)) return true;
  return false;
}

function revive(product: Product & { createdAt: string | Date; updatedAt: string | Date }): Product {
  return {
    ...product,
    gallery: product.gallery ?? null,
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
  };
}

function persistCatalog(remote = true) {
  if (persistEnabled) {
    try {
      fs.mkdirSync(path.dirname(persistPath), { recursive: true });
      fs.writeFileSync(persistPath, JSON.stringify({
        savedAt: new Date().toISOString(),
        products: memoryProducts,
      }));
    } catch (error) {
      console.error("[catalog] persist failed", error instanceof Error ? error.message : error);
    }
  }
  if (remote) enqueueShopBackup();
}

function restoreCatalog() {
  if (!persistEnabled || catalogLoaded) return;
  catalogLoaded = true;
  try {
    if (!fs.existsSync(persistPath)) return;
    const saved = JSON.parse(fs.readFileSync(persistPath, "utf8")) as {
      products?: Array<Product & { createdAt: string; updatedAt: string }>;
    };
    if (!Array.isArray(saved.products)) return;
    memoryProducts.splice(0, memoryProducts.length, ...saved.products.filter((product) => !isDummyProduct(product)).map(revive));
  } catch (error) {
    console.error("[catalog] restore failed", error instanceof Error ? error.message : error);
  }
}

restoreCatalog();

export function readLocalProducts(includeUnavailable = false) {
  restoreCatalog();
  const list = [...memoryProducts].sort((left, right) => right.id - left.id);
  return includeUnavailable ? list : list.filter((product) => product.isAvailable === 1);
}

export function exportLocalProducts() {
  restoreCatalog();
  return memoryProducts.map((product) => ({ ...product }));
}

export function importLocalProducts(products: Product[], remote = false) {
  catalogLoaded = true;
  memoryProducts.splice(0, memoryProducts.length, ...products.filter((product) => !isDummyProduct(product)).map(revive));
  persistCatalog(remote);
}

export function findLocalProduct(slug: string) {
  return memoryProducts.find((product) => product.slug === slug);
}

export function findLocalProductById(id: number) {
  return memoryProducts.find((product) => product.id === id);
}

export function saveLocalProduct(input: InsertProduct & { id?: number }) {
  const now = new Date();
  let nextId = input.id ?? Date.now();
  while (memoryProducts.some((item) => item.id === nextId)) nextId += 1;
  const product: Product = {
    id: nextId,
    slug: input.slug,
    name: input.name,
    category: input.category,
    era: input.era,
    priceCents: input.priceCents,
    currency: input.currency ?? "try",
    shortDescription: input.shortDescription,
    description: input.description,
    condition: input.condition,
    dimensions: input.dimensions ?? null,
    imageUrl: input.imageUrl,
    imageKey: input.imageKey ?? null,
    gallery: input.gallery ?? null,
    tag: input.tag ?? null,
    isAvailable: input.isAvailable ?? 1,
    isFeatured: input.isFeatured ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  memoryProducts.unshift(product);
  persistCatalog();
  return product;
}

export function patchLocalProduct(id: number, input: Partial<InsertProduct>) {
  const current = memoryProducts.find((product) => product.id === id);
  if (!current) return undefined;
  Object.assign(current, input, { updatedAt: new Date() });
  persistCatalog();
  return current;
}

export function removeLocalProduct(id: number) {
  const index = memoryProducts.findIndex((product) => product.id === id);
  if (index < 0) return undefined;
  const [removed] = memoryProducts.splice(index, 1);
  persistCatalog();
  return removed;
}

export function resetCatalogForTests() {
  catalogLoaded = true;
  memoryProducts.splice(0, memoryProducts.length);
}

export function localCatalogSavedAt() {
  try {
    if (!fs.existsSync(persistPath)) return "";
    const saved = JSON.parse(fs.readFileSync(persistPath, "utf8")) as { savedAt?: string };
    return saved.savedAt ?? "";
  } catch {
    return "";
  }
}
