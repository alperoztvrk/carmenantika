import { AnimatePresence, motion } from "framer-motion";
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
  const [cartPhase, setCartPhase] = useState<"closed" | "open" | "closing">("closed");
  const [searchTerm, setSearchTerm] = useState("");
  const [location] = useLocation();
  const { items, totalCents, removeItem } = useCart();
  const [now, setNow] = useState(() => Date.now());
  const cartOpenRef = useRef(false);
  const searchOpenRef = useRef(false);
  const mobileOpenRef = useRef(false);
  const pendingPath = useRef<string | null>(null);
  const cartSettled = useRef(false);
  cartOpenRef.current = cartPhase !== "closed";
  searchOpenRef.current = searchOpen;
  mobileOpenRef.current = mobileOpen;

  const settleCart = () => {
    if (cartSettled.current) return;
    cartSettled.current = true;
    const next = pendingPath.current;
    pendingPath.current = null;
    setCartPhase("closed");
    if (next) goWithCurtain(next);
  };

  const closeCart = () => setCartPhase((phase) => {
    if (phase !== "open") return phase;
    cartSettled.current = false;
    return "closing";
  });

  useEffect(() => {
    setCartPhase("closed");
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
    if (cartPhase !== "open") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cartPhase]);

  useEffect(() => {
    if (cartPhase !== "closing") return;
    const timer = window.setTimeout(settleCart, 480);
    return () => window.clearTimeout(timer);
  }, [cartPhase]);

  const go = (path: string) => {
    setMobileOpen(false);
    setSearchOpen(false);
    if (cartPhase === "open") {
      pendingPath.current = path;
      cartSettled.current = false;
      setCartPhase("closing");
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
    <>
      <div className="topline">
        <div className="container-carmen topline-inner">
          <span>Antalya'dan dünyanın her yerine</span>
          <span>Her parçanın bir hikâyesi var · keşfetmeye başla</span>
        </div>
      </div>
      <header className="site-header">
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
            <button className={`icon-button ${searchOpen ? "active" : ""}`} type="button" aria-label="Arama" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}>
              {searchOpen ? <X size={18} /> : <Search size={18} strokeWidth={1.7} />}
            </button>
            <button className="icon-button mobile-toggle" type="button" aria-label="Menüyü aç" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <button className={`cart-button ${cartPhase !== "closed" ? "active" : ""}`} type="button" onClick={() => { cartSettled.current = false; setCartPhase("open"); }}>
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
      </header>
      {cartPhase !== "closed" && (
          <div className={`cart-drawer-overlay ${cartPhase === "closing" ? "is-closing" : "is-open"}`} onClick={closeCart}>
            <aside
              className="quick-cart-drawer"
              onClick={(event) => event.stopPropagation()}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget || event.animationName !== "cart-slide-out") return;
                settleCart();
              }}
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
            </aside>
          </div>
        )}
    </>
  );
}
