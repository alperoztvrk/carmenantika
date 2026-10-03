import fs from "node:fs";
import path from "node:path";

export type ShopReview = {
  id: number;
  firstName: string;
  lastName: string;
  rating: number;
  body: string;
  createdAt: Date;
};

const persistPath = path.resolve(".data/carmen-reviews.json");
const persistEnabled = process.env.NODE_ENV !== "test";
const memory: ShopReview[] = [];
let nextId = 1;
let loaded = false;

const seeds: Omit<ShopReview, "id" | "createdAt">[] = [
  {
    firstName: "Elif",
    lastName: "Kaya",
    rating: 5,
    body: "Radyoyu elime alınca tam beklediğim sıcaklık vardı. Kondisyon notu dürüst, kargo da özenliydi.",
  },
  {
    firstName: "Mert",
    lastName: "Aydın",
    rating: 5,
    body: "Kamerayı fotoğraftaki haliyle geldi. Antalya’dan çıkan parçalar gerçekten seçilmiş duruyor.",
  },
  {
    firstName: "Selin",
    lastName: "Demir",
    rating: 4,
    body: "Oyuncak küçük izleriyle geldi, zaten yazılmıştı. Teslimat net, iletişim rahattı.",
  },
  {
    firstName: "Can",
    lastName: "Yılmaz",
    rating: 5,
    body: "Tek parça olduğunu hissediyorsun. Evde duruşu yeni değil, evin parçası olmuş gibi.",
  },
];

function persist() {
  if (!persistEnabled) return;
  try {
    fs.mkdirSync(path.dirname(persistPath), { recursive: true });
    fs.writeFileSync(persistPath, JSON.stringify({
      nextId,
      reviews: memory,
    }));
  } catch (error) {
    console.error("[reviews] persist failed", error instanceof Error ? error.message : error);
  }
}

function seedIfEmpty() {
  if (memory.length > 0) return;
  const stamp = Date.now() - 4 * 24 * 60 * 60 * 1000;
  for (let index = 0; index < seeds.length; index += 1) {
    memory.push({
      ...seeds[index],
      id: nextId,
      createdAt: new Date(stamp + index * 18 * 60 * 60 * 1000),
    });
    nextId += 1;
  }
}

function restore() {
  if (loaded) return;
  loaded = true;
  if (persistEnabled) {
    try {
      if (fs.existsSync(persistPath)) {
        const saved = JSON.parse(fs.readFileSync(persistPath, "utf8")) as {
          nextId?: number;
          reviews?: Array<ShopReview & { createdAt: string }>;
        };
        nextId = saved.nextId ?? 1;
        memory.splice(0, memory.length, ...(saved.reviews ?? []).map((review) => ({
          ...review,
          createdAt: new Date(review.createdAt),
        })));
      }
    } catch (error) {
      console.error("[reviews] restore failed", error instanceof Error ? error.message : error);
    }
  }
  seedIfEmpty();
  persist();
}

restore();

export function listReviews() {
  restore();
  return memory
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 40)
    .map((review) => ({ ...review }));
}

export function createReview(input: { firstName: string; lastName: string; rating: number; body: string }) {
  restore();
  const review: ShopReview = {
    id: nextId,
    firstName: input.firstName,
    lastName: input.lastName,
    rating: input.rating,
    body: input.body,
    createdAt: new Date(),
  };
  nextId += 1;
  memory.unshift(review);
  if (memory.length > 80) memory.splice(80);
  persist();
  return { ...review };
}

export function resetReviewsForTests() {
  loaded = true;
  nextId = 1;
  memory.splice(0, memory.length);
  seedIfEmpty();
}
