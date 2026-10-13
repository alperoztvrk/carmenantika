import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import { StoreImage } from "@/components/StoreImage";
import { useCart } from "@/contexts/CartContext";

export type ProductCardData = {
  id: number;
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  imageUrl: string;
  description?: string | null;
};

const money = (cents: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(cents / 100);

export function ProductCard({ product, index = 0 }: { product: ProductCardData; index?: number }) {
  const { addItem, hasItem } = useCart();
  return <article className="catalog-card" data-index={index}>
    <Link href={`/urun/${product.slug}`} className="catalog-card-image"><StoreImage src={product.imageUrl} alt={product.name} /><span className="catalog-card-arrow"><ArrowUpRight size={17} /></span></Link>
    <div className="catalog-card-meta"><div><Link href={`/urun/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.category}</p></div><div className="catalog-card-buy"><strong>{money(product.priceCents)}</strong><button type="button" className={`card-add ${hasItem(product.id) ? "added" : ""}`} onClick={() => addItem({ id: product.id, slug: product.slug, name: product.name, priceCents: product.priceCents, imageUrl: product.imageUrl, shortDescription: product.description ?? "" })} aria-label={`${product.name} sepete ekle`}><ShoppingBag size={15} />{hasItem(product.id) ? "Seçildi" : "Ekle"}</button></div></div>
  </article>;
}

export { money };
