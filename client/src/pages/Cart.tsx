import { ArrowLeft, ArrowRight, Check, LockKeyhole, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { StoreImage } from "@/components/StoreImage";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { holdLabel, useCart } from "@/contexts/CartContext";
import { forgetCheckoutOrder, rememberCheckoutOrder } from "@/lib/checkoutOrder";
import { trpc } from "@/lib/trpc";
import { money } from "@/components/ProductCard";

function checkoutErrorText(message: string) {
  if (!message || /failed to fetch|network|aborted|load failed|timeout/i.test(message)) {
    return "Ödeme sayfasına bağlanılamadı. Birkaç saniye sonra tekrar dene.";
  }
  return message;
}

export default function Cart() {
  const { items, totalCents, removeItem, clear, beginCheckoutHold, endCheckoutHold } = useCart();
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const cancelCheckout = trpc.order.cancelCheckout.useMutation();
  useEffect(() => {
    const orderNumber = new URLSearchParams(window.location.search).get("iptal");
    if (orderNumber) {
      forgetCheckoutOrder();
      cancelCheckout.mutate({ orderNumber });
    }
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const hold = items.length ? holdLabel(items.reduce((soon, item) => Math.min(soon, item.expiresAt), items[0].expiresAt), now) : "";
  const [message, setMessage] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  useEffect(() => {
    if (!paymentUrl) return;
    window.location.assign(paymentUrl);
  }, [paymentUrl]);
  const checkout = trpc.order.createCheckout.useMutation({
    onError: (error) => {
      endCheckoutHold();
      setMessage(checkoutErrorText(error.message));
    },
    onSuccess: (result) => {
      if (!result.url) {
        endCheckoutHold();
        setMessage("Ödeme bağlantısı oluşturulamadı.");
        return;
      }
      rememberCheckoutOrder(result.orderNumber);
      setPaymentUrl(result.url);
      window.location.assign(result.url);
    },
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const productIds = items.map((item) => item.id);
    beginCheckoutHold(productIds);
    try {
      await checkout.mutateAsync({ customerName: form.name, customerPhone: form.phone, shippingAddress: form.address, productIds });
    } catch {
      endCheckoutHold();
    }
  }
  return <StoreLayout><PageRise><section className="checkout-page"><div className="container-carmen"><div className="checkout-heading"><Link href="/koleksiyon"><ArrowLeft size={15} /> Koleksiyona dön</Link><span className="eyebrow">Carmen Antika / Çanta</span><h1>Seçtiklerin <em>burada.</em></h1></div>{items.length === 0 && !checkout.isPending && !paymentUrl ? <div className="empty-checkout"><Check size={30} /><h2>Çantan şu an boş.</h2><p>Bir parçanın hikâyesiyle eve dönmeye hazır mısın?</p><Link className="primary-cta" href="/koleksiyon">Koleksiyona git <ArrowRight size={15} /></Link>{message && <div className="checkout-message">{message}</div>}</div> : <div className="checkout-layout"><div className="checkout-items"><div className="checkout-list-head"><span>{items.length} tekil parça · {hold}</span><button type="button" onClick={clear}>Tümünü temizle</button></div>{items.map((item) => <article className="checkout-item" key={item.id}><StoreImage src={item.imageUrl} alt={item.name} /><div><Link href={`/urun/${item.slug}`}><h2>{item.name}</h2></Link><p>{item.shortDescription}</p><strong>{money(item.priceCents)}</strong></div><button type="button" aria-label={`${item.name} sil`} onClick={() => removeItem(item.id)}><Trash2 size={16} /></button></article>)}</div><form className="checkout-form" onSubmit={submit}><div className="checkout-form-head"><span className="eyebrow">Teslimat bilgileri</span><h2>Parçan nereye gelsin?</h2></div><label>Ad soyad<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Adın ve soyadın" /></label><label>Telefon<input required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="05xx xxx xx xx" /></label><label>Teslimat adresi<textarea required rows={4} value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Açık adresin" /></label><div className="checkout-total"><span>Toplam</span><strong>{money(totalCents)}</strong></div><button className="checkout-submit" type="submit" disabled={checkout.isPending}><LockKeyhole size={16} />{checkout.isPending ? "Ödeme hazırlanıyor..." : "Güvenli ödemeye geç"}<ArrowRight size={16} /></button><p className="checkout-note">Kart bilgilerin Carmen Antika sunucusunda tutulmaz. Ödeme iyzico'nun güvenli sayfasında, Türk lirası olarak tamamlanır.</p>{paymentUrl && <a className="checkout-submit" href={paymentUrl}>Ödeme sayfasına geç <ArrowRight size={16} /></a>}{message && <div className="checkout-message">{message}</div>}</form></div>}</div></section></PageRise></StoreLayout>;
}
