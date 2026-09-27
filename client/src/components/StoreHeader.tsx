import { ArrowRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { money } from "@/components/ProductCard";

export function StoreHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [, navigate] = useLocation();
  const { items, totalCents, removeItem } = useCart();

  const go = (path: string) => { setMobileOpen(false); navigate(path); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setSearchOpen(false); navigate(`/koleksiyon?q=${encodeURIComponent(searchTerm)}`); };

  return <>
    <div className="topline"><div className="container-carmen topline-inner"><span>Antalya'dan dünyanın her yerine</span><span>Her parçanın bir hikâyesi var · keşfetmeye başla</span></div></div>
    <header className="site-header">
      <div className="container-carmen header-main">
        <nav className="nav-links" aria-label="Ana menü"><Link href="/koleksiyon">Koleksiyon</Link><Link href="/hikayemiz">Hikâyemiz</Link></nav>
        <Link href="/" className="brand-lockup" aria-label="Carmen Antika ana sayfa"><span className="brand-name">Carmen Antika</span><span className="brand-sub">Flea market finds · Est. 2024</span></Link>
        <div className="header-actions">
          <button className={`icon-button ${searchOpen ? "active" : ""}`} type="button" aria-label="Arama" onClick={() => setSearchOpen((open) => !open)}>{searchOpen ? <X size={18} /> : <Search size={18} strokeWidth={1.7} />}</button>
          <button className="icon-button mobile-toggle" type="button" aria-label="Menüyü aç" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <button className={`cart-button ${cartOpen ? "active" : ""}`} type="button" onClick={() => setCartOpen(true)}><ShoppingBag size={15} strokeWidth={1.8} /><span className="cart-label">Çanta</span><span className="cart-count">{items.length}</span></button>
        </div>
      </div>
      {mobileOpen && <nav className="mobile-menu" aria-label="Mobil menü"><Link href="/koleksiyon" onClick={() => setMobileOpen(false)}>Koleksiyon</Link><Link href="/hikayemiz" onClick={() => setMobileOpen(false)}>Hikâyemiz</Link><Link href="/siparislerim" onClick={() => setMobileOpen(false)}>Siparişlerim</Link></nav>}
      <div className={`search-panel ${searchOpen ? "open" : ""}`} aria-hidden={!searchOpen}><form className="container-carmen search-panel-form" onSubmit={submitSearch}><span className="eyebrow">Parça ara</span><div><input autoFocus={searchOpen} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Bir radyo, oyuncak veya dönem ara..." /><button type="submit" aria-label="Arama yap"><ArrowRight size={21} /></button></div></form></div>
    </header>
    <div className={`cart-drawer-overlay ${cartOpen ? "open" : ""}`} onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="quick-cart-drawer"><div className="quick-cart-head"><div><span className="eyebrow">Carmen Antika</span><h2>Çantan</h2></div><button type="button" onClick={() => setCartOpen(false)} aria-label="Çantayı kapat"><X size={20} /></button></div>{items.length === 0 ? <div className="quick-cart-empty"><ShoppingBag size={28} /><p>Henüz bir parça seçmedin.</p><button type="button" onClick={() => { setCartOpen(false); go("/koleksiyon"); }}>Koleksiyona dön <ArrowRight size={15} /></button></div> : <><div className="quick-cart-items">{items.map((item) => <div className="quick-cart-item" key={item.id}><img src={item.imageUrl} alt="" /><div><strong>{item.name}</strong><span>{money(item.priceCents)}</span></div><button type="button" onClick={() => removeItem(item.id)} aria-label="Ürünü çıkar"><X size={14} /></button></div>)}</div><div className="quick-cart-total"><span>Toplam</span><strong>{money(totalCents)}</strong></div><Link className="quick-cart-cta" href="/sepet" onClick={() => setCartOpen(false)}>Siparişi tamamla <ArrowRight size={16} /></Link></>}</aside></div>
  </>;
}
