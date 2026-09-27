import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { StoreLayout } from "@/components/StoreLayout";
import { useReveal } from "@/hooks/useReveal";
import { trpc } from "@/lib/trpc";

export default function Collection() {
  const { data, isLoading, error } = trpc.product.list.useQuery();
  const [activeCategory, setActiveCategory] = useState("Tümü");
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  useReveal(`${data?.length ?? 0}:${activeCategory}`);

  const categories = useMemo(() => ["Tümü", ...Array.from(new Set((data ?? []).map((product) => product.category)))], [data]);
  const products = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return (data ?? []).filter((product) => {
      const categoryMatch = activeCategory === "Tümü" || product.category === activeCategory;
      const searchMatch = !normalized || `${product.name} ${product.era} ${product.shortDescription}`.toLocaleLowerCase("tr-TR").includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, data, query]);

  return <StoreLayout><section className="catalog-hero"><div className="container-carmen catalog-hero-inner"><div><span className="eyebrow">Carmen Antika / Koleksiyon</span><h1>Pazardan<br /><em>gelenler.</em></h1><p>Her biri tek olan küçük keşifler. Birinin artık kullanmadığı, senin yıllardır aradığın şey olabilir.</p></div><div className="catalog-mark"><span>01</span><small>tekil stok<br />günlük keşif</small></div></div></section><section className="catalog-shell"><div className="container-carmen"><div className="catalog-toolbar"><div className="catalog-filters"><SlidersHorizontal size={15} /><span>Filtrele</span>{categories.map((category) => <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)} type="button">{category}</button>)}</div><label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Parça ara..." aria-label="Koleksiyonda ara" /></label></div>{isLoading ? <div className="catalog-state">Koleksiyon açılıyor...</div> : error ? <div className="catalog-state">Koleksiyon şu an dinleniyor. Lütfen biraz sonra tekrar dene.</div> : products.length === 0 ? <div className="catalog-state"><h2>Bu aramada parça bulunamadı.</h2><p>Başka bir kelime ya da kategori deneyebilirsin.</p></div> : <><div className="catalog-summary"><span>{products.length} parça</span><span>Her ürün tek stokludur</span></div><div className="catalog-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div></>}</div></section></StoreLayout>;
}
