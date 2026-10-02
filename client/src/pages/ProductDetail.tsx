import { ArrowLeft, ArrowRight, Check, Heart, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { StoreImage } from "@/components/StoreImage";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { money } from "@/components/ProductCard";
import { trpc } from "@/lib/trpc";
import { SHOP_PHONE, SHOP_PHONE_TEL } from "@/lib/shop";

export default function ProductDetail({ params }: { params: { slug?: string } }) {
  const slug = params.slug ?? "";
  const { data: product, isLoading, error } = trpc.product.getBySlug.useQuery({ slug });
  const { addItem, hasItem } = useCart();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!product?.id) return;
    try {
      const ids = JSON.parse(window.localStorage.getItem("carmen-antika-saved") || "[]") as number[];
      setSaved(Array.isArray(ids) && ids.includes(product.id));
    } catch {
      setSaved(false);
    }
  }, [product?.id]);

  if (isLoading) return <StoreLayout><div className="detail-state">Parçanın hikâyesi açılıyor...</div></StoreLayout>;
  if (error || !product) return <StoreLayout><div className="detail-state"><h1>Bu parça yerini bulmuş olabilir.</h1><p>Aradığın ürün artık koleksiyonda değil.</p><Link href="/koleksiyon" className="text-link">Koleksiyona dön <ArrowRight size={15} /></Link></div></StoreLayout>;

  const cartProduct = { id: product.id, slug: product.slug, name: product.name, priceCents: product.priceCents, imageUrl: product.imageUrl, shortDescription: product.shortDescription };
  const selected = hasItem(product.id);
  const toggleSaved = () => {
    const key = "carmen-antika-saved";
    let ids: number[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as number[];
      if (Array.isArray(parsed)) ids = parsed.filter((id) => id !== product.id);
    } catch { ids = []; }
    window.localStorage.setItem(key, JSON.stringify(saved ? ids : [...ids, product.id]));
    setSaved((current) => !current);
  };

  return <StoreLayout><PageRise><div className="detail-breadcrumb container-carmen"><Link href="/koleksiyon"><ArrowLeft size={15} /> Koleksiyona dön</Link><span> / {product.category}</span></div><section className="detail-layout container-carmen"><div className="detail-gallery reveal-on-scroll" data-reveal><div className="detail-image-wrap"><StoreImage src={product.imageUrl} alt={product.name} /></div><div className="detail-image-caption"><span>Tek parça / {product.era}</span><button type="button" aria-pressed={saved} aria-label={saved ? "Favorilerden çıkar" : "Favorilere ekle"} onClick={toggleSaved}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button></div></div><div className="detail-copy reveal-on-scroll" data-reveal style={{ "--reveal-delay": "110ms" } as React.CSSProperties}><span className="eyebrow">{product.category} · {product.era}</span><h1>{product.name}</h1><p className="detail-lede">{product.shortDescription}</p><div className="detail-price">{money(product.priceCents)}</div><div className="detail-actions"><button className={`detail-add ${selected ? "selected" : ""}`} type="button" disabled={!product.isAvailable || selected} onClick={() => addItem(cartProduct)}>{selected ? <><Check size={17} /> Çantanda</> : <><ShoppingBag size={17} /> Çantaya ekle</>}</button>{selected && <Link className="detail-checkout" href="/sepet">Sepete git <ArrowRight size={15} /></Link>}</div><div className="detail-trust"><div><Truck size={17} /><span>2–4 iş gününde<br /><b>özenli kargo</b></span></div><div><ShieldCheck size={17} /><span>Güvenli ödeme<br /><b>iyzico</b></span></div></div><p className="detail-call">Soru veya pazarlık: <a href={SHOP_PHONE_TEL}>{SHOP_PHONE}</a></p><div className="detail-info"><div><span>Hikâyesi</span><p>{product.description}</p></div><div><span>Kondisyon</span><p>{product.condition}</p></div>{product.dimensions && <div><span>Ölçüler</span><p>{product.dimensions}</p></div>}</div></div></section></PageRise></StoreLayout>;
}
