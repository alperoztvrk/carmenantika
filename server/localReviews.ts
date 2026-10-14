import fs from "node:fs";
import path from "node:path";
import { dataFile } from "./dataFile";
import { enqueueShopBackup } from "./shopRemote";

export type ShopReview = {
  id: number;
  firstName: string;
  lastName: string;
  rating: number;
  body: string;
  createdAt: Date;
};

const persistPath = dataFile("carmen-guest-reviews.json");
const persistEnabled = process.env.NODE_ENV !== "test";
const memory: ShopReview[] = [];
let nextId = 1;
let loaded = false;

function persist(remote = true) {
  if (persistEnabled) {
    try {
      fs.mkdirSync(path.dirname(persistPath), { recursive: true });
      fs.writeFileSync(persistPath, JSON.stringify({
        savedAt: new Date().toISOString(),
        nextId,
        reviews: memory,
      }));
    } catch (error) {
      console.error("[reviews] persist failed", error instanceof Error ? error.message : error);
    }
  }
  if (remote) enqueueShopBackup();
}

function restore() {
  if (loaded) return;
  loaded = true;
  if (!persistEnabled) return;
  try {
    if (!fs.existsSync(persistPath)) return;
    const saved = JSON.parse(fs.readFileSync(persistPath, "utf8")) as {
      nextId?: number;
      reviews?: Array<ShopReview & { createdAt: string }>;
    };
    nextId = saved.nextId ?? 1;
    memory.splice(0, memory.length, ...(saved.reviews ?? []).map((review) => ({
      ...review,
      createdAt: new Date(review.createdAt),
    })));
  } catch (error) {
    console.error("[reviews] restore failed", error instanceof Error ? error.message : error);
  }
}

restore();

export function listReviews() {
  restore();
  return memory
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((review) => ({ ...review }));
}

export function deleteReview(id: number) {
  restore();
  const index = memory.findIndex((review) => review.id === id);
  if (index < 0) return false;
  memory.splice(index, 1);
  persist();
  return true;
}

export function createReview(input: { firstName: string; lastName: string; rating: number; body: string }) {
  restore();
  let id = Date.now();
  while (memory.some((item) => item.id === id)) id += 1;
  const review: ShopReview = {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    rating: input.rating,
    body: input.body,
    createdAt: new Date(),
  };
  nextId = Math.max(nextId, id + 1);
  memory.unshift(review);
  persist();
  return { ...review };
}

export function resetReviewsForTests() {
  loaded = true;
  nextId = 1;
  memory.splice(0, memory.length);
}

export function exportLocalReviews() {
  restore();
  return {
    nextId,
    reviews: memory.map((review) => ({ ...review })),
  };
}

export function importLocalReviews(input: { nextId?: number; reviews?: ShopReview[] }, remote = false) {
  loaded = true;
  nextId = input.nextId ?? 1;
  memory.splice(0, memory.length, ...(input.reviews ?? []).map((review) => ({
    ...review,
    createdAt: new Date(review.createdAt),
  })));
  persist(remote);
}
