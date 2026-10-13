import { ArrowLeft, ArrowRight, Check, Heart, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { parseGallery } from "@shared/productImages";
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
  const [activeImage, setActiveImage] = useState(0);
  useEffect(() => {
    if (!product?.id) return;
    setActiveImage(0);
    try {
      const ids = JSON.parse(window.localStorage.getItem("carmen-antika-saved") || "[]") as number[];
      setSaved(Array.isArray(ids) && ids.includes(product.id));
    } catch {
      setSaved(false);
    }
  }, [product?.id]);

  if (isLoading) return <StoreLayout><div className="detail-state">Ürün açılıyor...</div></StoreLayout>;
  if (error || !product) return <StoreLayout><div className="detail-state"><h1>Bu parça yerini bulmuş olabilir.</h1><p>Aradığın ürün artık koleksiyonda değil.</p><Link href="/koleksiyon" className="text-link">Koleksiyona dön <ArrowRight size={15} /></Link></div></StoreLayout>;

  const images = product.imageUrls?.length ? product.imageUrls : parseGallery(product.gallery, product.imageUrl);
  const currentImage = images[Math.min(activeImage, Math.max(images.length - 1, 0))] || product.imageUrl;
  const cartProduct = { id: product.id, slug: product.slug, name: product.name, priceCents: product.priceCents, imageUrl: currentImage || product.imageUrl, shortDescription: product.description };
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

  return (
    <StoreLayout>
      <PageRise>
        <div className="detail-breadcrumb container-carmen">
          <Link href="/koleksiyon"><ArrowLeft size={15} /> Koleksiyona dön</Link>
          <span> / {product.category}</span>
        </div>
        <section className="detail-layout container-carmen">
          <div className="detail-gallery reveal-on-scroll" data-reveal>
            <div className="detail-image-wrap"><StoreImage src={currentImage} alt={product.name} /></div>
            {images.length > 1 && (
              <div className="detail-thumbs">
                {images.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    className={index === activeImage ? "active" : ""}
                    aria-label={`Görsel ${index + 1}`}
                    onClick={() => setActiveImage(index)}
                  >
                    <StoreImage src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="detail-image-caption">
              <span>Tek parça</span>
              <button type="button" aria-pressed={saved} aria-label={saved ? "Favorilerden çıkar" : "Favorilere ekle"} onClick={toggleSaved}>
                <Heart size={17} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          <div className="detail-copy reveal-on-scroll" data-reveal style={{ "--reveal-delay": "110ms" } as React.CSSProperties}>
            <span className="eyebrow">{product.category}</span>
            <h1>{product.name}</h1>
            <div className="detail-price">{money(product.priceCents)}</div>
            <div className="detail-actions">
              <button className={`detail-add ${selected ? "selected" : ""}`} type="button" disabled={!product.isAvailable || selected} onClick={() => addItem(cartProduct)}>
                {selected ? <><Check size={17} /> Çantanda</> : <><ShoppingBag size={17} /> Çantaya ekle</>}
              </button>
              {selected && <Link className="detail-checkout" href="/sepet">Sepete git <ArrowRight size={15} /></Link>}
            </div>
            <div className="detail-trust">
              <div><Truck size={17} /><span>2–4 iş gününde<br /><b>özenli kargo</b></span></div>
              <div><ShieldCheck size={17} /><span>Güvenli ödeme<br /><b>çok yakında</b></span></div>
            </div>
            <p className="detail-call">Soru veya pazarlık: <a href={SHOP_PHONE_TEL}>{SHOP_PHONE}</a></p>
            {product.description.trim() ? (
              <div className="detail-info">
                <div>
                  <span>Açıklama</span>
                  <p>{product.description}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </PageRise>
    </StoreLayout>
  );
}
