import { ArrowLeft, ArrowRight, Check, LockKeyhole, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { StoreImage } from "@/components/StoreImage";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { holdLabel, useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { money } from "@/components/ProductCard";

export default function Cart() {
  const { items, totalCents, removeItem, clear } = useCart();
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({ name: "", email: "", address: "" });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const hold = items.length ? holdLabel(items.reduce((soon, item) => Math.min(soon, item.expiresAt), items[0].expiresAt), now) : "";
  const [message, setMessage] = useState("");
  const checkout = trpc.order.createCheckout.useMutation({ onError: (error) => setMessage(error.message) });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await checkout.mutateAsync({ customerName: form.name, customerEmail: form.email, shippingAddress: form.address, productIds: items.map((item) => item.id) });
      if (result.url) {
        clear();
        window.open(result.url, "_blank", "noopener,noreferrer");
        setMessage("Güvenli ödeme sayfası yeni sekmede açıldı.");
      } else setMessage("Ödeme bağlantısı oluşturulamadı.");
    } catch { /* mutation onError renders the user-facing message */ }
  }
  return <StoreLayout><PageRise><section className="checkout-page"><div className="container-carmen"><div className="checkout-heading"><Link href="/koleksiyon"><ArrowLeft size={15} /> Koleksiyona dön</Link><span className="eyebrow">Carmen Antika / Çanta</span><h1>Seçtiklerin <em>burada.</em></h1></div>{items.length === 0 ? <div className="empty-checkout"><Check size={30} /><h2>Çantan şu an boş.</h2><p>Bir parçanın hikâyesiyle eve dönmeye hazır mısın?</p><Link className="primary-cta" href="/koleksiyon">Koleksiyona git <ArrowRight size={15} /></Link></div> : <div className="checkout-layout"><div className="checkout-items"><div className="checkout-list-head"><span>{items.length} tekil parça · {hold}</span><button type="button" onClick={clear}>Tümünü temizle</button></div>{items.map((item) => <article className="checkout-item" key={item.id}><StoreImage src={item.imageUrl} alt={item.name} /><div><Link href={`/urun/${item.slug}`}><h2>{item.name}</h2></Link><p>{item.shortDescription}</p><strong>{money(item.priceCents)}</strong></div><button type="button" aria-label={`${item.name} sil`} onClick={() => removeItem(item.id)}><Trash2 size={16} /></button></article>)}</div><form className="checkout-form" onSubmit={submit}><div className="checkout-form-head"><span className="eyebrow">Teslimat bilgileri</span><h2>Parçan nereye gelsin?</h2></div><label>Ad soyad<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Adın ve soyadın" /></label><label>E-posta<input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="sen@email.com" /></label><label>Teslimat adresi<textarea required rows={4} value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Açık adresin" /></label><div className="checkout-total"><span>Toplam</span><strong>{money(totalCents)}</strong></div><button className="checkout-submit" type="submit" disabled={checkout.isPending}><LockKeyhole size={16} />{checkout.isPending ? "Ödeme hazırlanıyor..." : "Güvenli ödemeye geç"}<ArrowRight size={16} /></button><p className="checkout-note">Kart bilgilerin Carmen Antika sunucusunda tutulmaz. Ödeme Stripe'ın güvenli sayfasında tamamlanır.</p>{message && <div className="checkout-message">{message}</div>}</form></div>}</div></section></PageRise></StoreLayout>;
}
