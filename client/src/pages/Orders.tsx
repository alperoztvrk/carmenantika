import { ArrowRight, Clock3, PackageCheck, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";

const statusLabel: Record<string, string> = {
  pending: "Ödeme bekleniyor",
  paid: "Ödendi",
  cancelled: "İptal",
  fulfilled: "Teslim edildi",
};

export default function Orders() {
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.order.mine.useQuery();
  const lookup = trpc.order.lookup.useMutation({
    onSuccess: () => {
      utils.order.mine.invalidate();
    },
  });
  const [form, setForm] = useState({ orderNumber: "", phone: "" });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    lookup.mutate({ orderNumber: form.orderNumber, customerPhone: form.phone });
  }

  return (
    <StoreLayout>
      <PageRise>
        <section className="orders-page">
          <div className="container-carmen">
            <div className="orders-heading">
              <span className="eyebrow">Carmen Antika / Siparişlerim</span>
              <h1>Sipariş <em>geçmişin.</em></h1>
              <p>Hesap açmana gerek yok. Bu telefonda verdiğin siparişler burada durur. Başka bir cihazdan bakacaksan sipariş numarası ve telefonun yeter.</p>
            </div>
            <form className="orders-lookup" onSubmit={submit}>
              <div>
                <span className="eyebrow">Siparişini bul</span>
                <h2>Numara ve telefon</h2>
              </div>
              <label>
                Sipariş numarası
                <input value={form.orderNumber} onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value.toUpperCase() }))} placeholder="CA-..." autoComplete="off" />
              </label>
              <label>
                Telefon
                <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Ödemede yazdığın numara" />
              </label>
              <button className="checkout-submit" type="submit" disabled={lookup.isPending}>
                <Search size={16} /> {lookup.isPending ? "Aranıyor..." : "Siparişi getir"}
              </button>
              {lookup.error && <p className="admin-message is-error">{lookup.error.message}</p>}
            </form>
            {isLoading ? (
              <div className="catalog-state">Siparişler yükleniyor...</div>
            ) : (orders ?? []).length === 0 ? (
              <div className="empty-checkout">
                <PackageCheck size={30} />
                <h2>Bu cihazda henüz sipariş yok.</h2>
                <p>Sipariş numaran ve telefonunla yukarıdan da bakabilirsin.</p>
                <Link className="primary-cta" href="/koleksiyon">Koleksiyona git <ArrowRight size={15} /></Link>
              </div>
            ) : (
              <div className="orders-list">
                {orders?.map((order) => (
                  <article className="order-row" key={order.id}>
                    <div className="order-row-icon">{order.status === "paid" ? <PackageCheck size={20} /> : <Clock3 size={20} />}</div>
                    <div className="order-row-body">
                      <strong>{order.orderNumber}</strong>
                      <span>{new Date(order.createdAt).toLocaleDateString("tr-TR")}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</span>
                      {order.items?.length ? <span>{order.items.map((item) => item.productName).join(", ")}</span> : null}
                    </div>
                    <b>{(order.totalCents / 100).toLocaleString("tr-TR")} ₺</b>
                    <em>{statusLabel[order.status] ?? order.status}</em>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </PageRise>
    </StoreLayout>
  );
}
