export const MAX_PRODUCT_IMAGES = 12;

export function parseGallery(gallery: string | null | undefined, imageUrl?: string | null) {
  let extra: string[] = [];
  if (gallery) {
    try {
      const parsed = JSON.parse(gallery) as unknown;
      if (Array.isArray(parsed)) extra = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    } catch {
      extra = [];
    }
  }
  const urls = [imageUrl, ...extra].filter((item): item is string => Boolean(item && item.trim()));
  return Array.from(new Set(urls)).slice(0, MAX_PRODUCT_IMAGES);
}

export function packGallery(urls: string[]) {
  const unique = Array.from(new Set(urls.map((item) => item.trim()).filter(Boolean))).slice(0, MAX_PRODUCT_IMAGES);
  return { imageUrl: unique[0] ?? "", gallery: JSON.stringify(unique) };
}
