import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { StoreImage } from "@/components/StoreImage";
import { money } from "@/components/ProductCard";
import { goWithCurtain } from "@/components/PageCurtain";
import { holdLabel, useCart } from "@/contexts/CartContext";

const ease = [0.22, 0.8, 0.24, 1] as const;

export function StoreHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [location] = useLocation();
  const { items, totalCents, removeItem } = useCart();
  const [now, setNow] = useState(() => Date.now());
  const cartOpenRef = useRef(false);
  const searchOpenRef = useRef(false);
  const mobileOpenRef = useRef(false);
  const pendingPath = useRef<string | null>(null);
  cartOpenRef.current = cartOpen;
  searchOpenRef.current = searchOpen;
  mobileOpenRef.current = mobileOpen;

  const closeCart = () => setCartOpen(false);

  const finishCartExit = () => {
    const next = pendingPath.current;
    pendingPath.current = null;
    if (next) goWithCurtain(next);
  };

  useEffect(() => {
    setCartOpen(false);
    setSearchOpen(false);
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (cartOpenRef.current) closeCart();
      else if (searchOpenRef.current) setSearchOpen(false);
      else if (mobileOpenRef.current) setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!cartOpen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cartOpen]);

  const go = (path: string) => {
    setMobileOpen(false);
    setSearchOpen(false);
    if (cartOpen) {
      pendingPath.current = path;
      setCartOpen(false);
      return;
    }
    goWithCurtain(path);
  };
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchOpen(false);
    go(`/koleksiyon?q=${encodeURIComponent(searchTerm)}`);
  };

  return (
    <MotionConfig reducedMotion="never">
      <motion.div className="topline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55, ease }}>
        <div className="container-carmen topline-inner">
          <span>Antalya'dan dünyanın her yerine</span>
          <span>Her parçanın bir hikâyesi var · keşfetmeye başla</span>
        </div>
      </motion.div>
      <motion.header className="site-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.08, ease }}>
        <div className="container-carmen header-main">
          <nav className="nav-links" aria-label="Ana menü">
            <Link href="/koleksiyon" className={location.startsWith("/koleksiyon") || location.startsWith("/urun") ? "is-current" : ""}>
              Koleksiyon
              {(location.startsWith("/koleksiyon") || location.startsWith("/urun")) && <motion.span layoutId="nav-underline" className="nav-underline" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
            </Link>
            <Link href="/hikayemiz" className={location.startsWith("/hikayemiz") ? "is-current" : ""}>
              Hikâyemiz
              {location.startsWith("/hikayemiz") && <motion.span layoutId="nav-underline" className="nav-underline" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
            </Link>
          </nav>
          <Link href="/" className="brand-lockup" aria-label="Carmen Antika ana sayfa">
            <span className="brand-name">Carmen Antika</span>
            <span className="brand-sub">Flea market finds · Est. 2024</span>
          </Link>
          <div className="header-actions">
            <button className={`icon-button ${searchOpen ? "active" : ""}`} type="button" aria-label="Arama" aria-expanded={searchOpen} onClick={() => { setMobileOpen(false); setSearchOpen((open) => !open); }}>
              {searchOpen ? <X size={18} /> : <Search size={18} strokeWidth={1.7} />}
            </button>
            <button className="icon-button mobile-toggle" type="button" aria-label="Menüyü aç" aria-expanded={mobileOpen} onClick={() => { setSearchOpen(false); setMobileOpen((open) => !open); }}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <button className={`cart-button ${cartOpen ? "active" : ""}`} type="button" onClick={() => setCartOpen(true)}>
              <ShoppingBag size={15} strokeWidth={1.8} />
              <span className="cart-label">Çanta</span>
              <span className="cart-count">{items.length}</span>
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              className="mobile-menu"
              aria-label="Mobil menü"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease }}
            >
              {[
                ["/koleksiyon", "Koleksiyon"],
                ["/hikayemiz", "Hikâyemiz"],
                ["/siparislerim", "Siparişlerim"],
              ].map(([href, label], index) => (
                <motion.div key={href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.06, duration: 0.4, ease }}>
                  <Link href={href} onClick={() => setMobileOpen(false)}>{label}</Link>
                </motion.div>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              className="search-panel open"
              initial={{ height: 0, opacity: 0, y: -16 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -12 }}
              transition={{ duration: 0.55, ease }}
            >
              <form className="container-carmen search-panel-form" onSubmit={submitSearch}>
                <span className="eyebrow">Parça ara</span>
                <div>
                  <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Bir radyo, oyuncak veya dönem ara..." />
                  <button type="submit" aria-label="Arama yap"><ArrowRight size={21} /></button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      {cartOpen && <div className="cart-drawer-overlay" onClick={closeCart} />}
      <MotionConfig reducedMotion="never">
        <AnimatePresence onExitComplete={finishCartExit}>
          {cartOpen && (
            <motion.aside
              key="quick-cart"
              className="quick-cart-drawer"
              initial={{ x: "105%" }}
              animate={{ x: 0 }}
              exit={{ x: "105%" }}
              transition={{ duration: 0.55, ease }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="quick-cart-head">
                <div>
                  <span className="eyebrow">Carmen Antika</span>
                  <h2>Çantan</h2>
                </div>
                <button type="button" onClick={closeCart} aria-label="Çantayı kapat"><X size={20} /></button>
              </div>
              {items.length === 0 ? (
                <div className="quick-cart-empty">
                  <ShoppingBag size={28} />
                  <p>Henüz bir parça seçmedin.</p>
                  <button type="button" onClick={() => go("/koleksiyon")}>Koleksiyona dön <ArrowRight size={15} /></button>
                </div>
              ) : (
                <>
                  <div className="quick-cart-items">
                    {items.map((item) => (
                      <div className="quick-cart-item" key={item.id}>
                        <StoreImage src={item.imageUrl} alt="" />
                        <div>
                          <strong>{item.name}</strong>
                          <span>{money(item.priceCents)}</span>
                          <em>{holdLabel(item.expiresAt, now)}</em>
                        </div>
                        <button type="button" onClick={() => removeItem(item.id)} aria-label="Ürünü çıkar"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="quick-cart-total">
                    <span>Toplam</span>
                    <strong>{money(totalCents)}</strong>
                  </div>
                  <button className="quick-cart-cta" type="button" onClick={() => go("/sepet")}>Siparişi tamamla <ArrowRight size={16} /></button>
                </>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </MotionConfig>
    </MotionConfig>
  );
}
