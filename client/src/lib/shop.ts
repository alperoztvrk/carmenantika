export const SHOP_PHONE = "0552 442 42 28";
export const SHOP_PHONE_TEL = "tel:+905524424228";
export const COLLECTION_HREF = "/#koleksiyon";
export const CHECKOUT_COMING_SOON = "Online sipariş çok yakında. Şimdilik 0552 442 42 28’i ara, parçanı senin için ayıralım.";

export function scrollToCollection() {
  document.getElementById("koleksiyon")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
