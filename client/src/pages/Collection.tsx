import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { HeroEnter, heroItem } from "@/components/PageMotion";
import { ProductCard } from "@/components/ProductCard";
import { StoreLayout } from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";

const ease = [0.22, 0.8, 0.24, 1] as const;
const staggerBlock = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

export default function Collection() {
  const { data, isLoading, error } = trpc.product.list.useQuery(undefined, { refetchInterval: 8_000 });
  const [activeCategory, setActiveCategory] = useState("Tümü");
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");

  const categories = useMemo(() => ["Tümü", ...Array.from(new Set((data ?? []).map((product) => product.category)))], [data]);
  const products = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return (data ?? []).filter((product) => {
      const categoryMatch = activeCategory === "Tümü" || product.category === activeCategory;
      const searchMatch = !normalized || `${product.name} ${product.era} ${product.shortDescription}`.toLocaleLowerCase("tr-TR").includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, data, query]);

  return (
    <StoreLayout>
      <section className="catalog-hero">
        <HeroEnter className="container-carmen catalog-hero-inner">
          <motion.div className="from-bar-copy" variants={staggerBlock}>
            <motion.span className="eyebrow" variants={heroItem}>Carmen Antika / Koleksiyon</motion.span>
            <motion.h1 variants={staggerBlock}>
              <motion.span className="hero-line" variants={heroItem}>Seçilmiş</motion.span>
              <motion.span className="hero-line" variants={heroItem}><em>parçalar.</em></motion.span>
            </motion.h1>
            <motion.p variants={heroItem}>Her biri tek olan küçük keşifler. Birinin artık kullanmadığı, senin yıllardır aradığın şey olabilir.</motion.p>
          </motion.div>
          <motion.div className="catalog-mark" variants={heroItem}>
            <span>01</span>
            <small>tekil stok<br />günlük keşif</small>
          </motion.div>
        </HeroEnter>
      </section>
      <section className="catalog-shell">
        <div className="container-carmen">
          <motion.div className="catalog-toolbar" initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease }}>
            <div className="catalog-filters">
              <SlidersHorizontal size={15} />
              <span>Filtrele</span>
              {categories.map((category) => (
                <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)} type="button">
                  {category}
                  {activeCategory === category && <motion.i layoutId="catalog-filter" className="filter-underline" />}
                </button>
              ))}
            </div>
            <label className="catalog-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Parça ara..." aria-label="Koleksiyonda ara" />
            </label>
          </motion.div>
          {isLoading ? (
            <div className="catalog-state motion-reveal">Koleksiyon açılıyor...</div>
          ) : error ? (
            <div className="catalog-state motion-reveal">Koleksiyon şu an dinleniyor. Lütfen biraz sonra tekrar dene.</div>
          ) : products.length === 0 ? (
            <div className="catalog-state motion-reveal">
              <h2>Bu aramada parça bulunamadı.</h2>
              <p>Başka bir kelime ya da kategori deneyebilirsin.</p>
            </div>
          ) : (
            <>
              <div className="catalog-summary motion-reveal">
                <span>{products.length} parça</span>
                <span>Her ürün tek stokludur</span>
              </div>
              <div className="catalog-grid">
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ y: 16 }}
                    whileInView={{ y: 0 }}
                    viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
                    transition={{ duration: 0.8, delay: (index % 4) * 0.09, ease }}
                  >
                    <ProductCard product={product} index={index} />
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </StoreLayout>
  );
}
