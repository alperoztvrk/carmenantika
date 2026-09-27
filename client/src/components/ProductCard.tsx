import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/contexts/CartContext";

export type ProductCardData = {
  id: number;
  slug: string;
  name: string;
  era: string;
  priceCents: number;
  imageUrl: string;
  tag?: string | null;
  shortDescription: string;
};

const money = (cents: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(cents / 100);

export function ProductCard({ product, index = 0 }: { product: ProductCardData; index?: number }) {
  const { addItem, hasItem } = useCart();
  return <article className="catalog-card reveal-on-scroll" data-reveal style={{ "--reveal-delay": `${index * 55}ms` } as React.CSSProperties}>
    <Link href={`/urun/${product.slug}`} className="catalog-card-image"><img src={product.imageUrl} alt={product.name} loading="lazy" />{product.tag && <span className="product-tag">{product.tag}</span>}<span className="catalog-card-arrow"><ArrowUpRight size={17} /></span></Link>
    <div className="catalog-card-meta"><div><Link href={`/urun/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.era}</p></div><div className="catalog-card-buy"><strong>{money(product.priceCents)}</strong><button type="button" className={`card-add ${hasItem(product.id) ? "added" : ""}`} onClick={() => addItem(product)} aria-label={`${product.name} sepete ekle`}><ShoppingBag size={15} />{hasItem(product.id) ? "Seçildi" : "Ekle"}</button></div></div>
  </article>;
}

export { money };
