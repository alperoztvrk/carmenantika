import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { money } from "@/components/ProductCard";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { useCart } from "@/contexts/CartContext";
import { forgetCheckoutOrder, peekCheckoutOrder } from "@/lib/checkoutOrder";
import { trpc } from "@/lib/trpc";

export default function OrderSuccess() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("order") || peekCheckoutOrder();
  const sessionId = params.get("session_id") ?? "";
  const { clear } = useCart();
  const utils = trpc.useUtils();
  const cleared = useRef(false);
  const started = useRef(false);
  const confirm = trpc.order.confirmPayment.useMutation({
    onSuccess: () => {
      if (orderNumber) utils.order.byNumber.invalidate({ orderNumber });
    },
  });
  const { data: order } = trpc.order.byNumber.useQuery(
    { orderNumber },
    { enabled: Boolean(orderNumber), refetchInterval: 2000 },
  );

  useEffect(() => {
    if (orderNumber) forgetCheckoutOrder();
  }, [orderNumber]);

  useEffect(() => {
    if (!orderNumber || !order || order.status !== "pending" || started.current) return;
    started.current = true;
    confirm.mutate({ orderNumber, sessionId: sessionId || undefined });
  }, [confirm, order, orderNumber, sessionId]);

  useEffect(() => {
    if (!orderNumber || cleared.current) return;
    if (order && order.status === "cancelled") return;
    cleared.current = true;
    clear();
  }, [clear, order, orderNumber]);

  return (
    <StoreLayout>
      <PageRise>
        <section className="success-page">
          <div className="success-card">
            <div className="success-icon"><Check size={28} /></div>
            <span className="eyebrow">Carmen Antika / Sipariş</span>
            <h1>Siparişin <em>başarılı.</em></h1>
            <p>Ödemen alındı. Kısa mesaj ile de bilgilendirme gelecek. Parçanı Antalya'dan özenle paketleyip yola çıkaracağız.</p>
            {orderNumber && (
              <div className="order-number">
                <span>Sipariş numarası</span>
                <strong>{orderNumber}</strong>
              </div>
            )}
            {order?.items && order.items.length > 0 && (
              <ul className="success-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.productName}</span>
                    <b>{money(item.priceCents)}</b>
                  </li>
                ))}
                <li className="success-total">
                  <span>Tutar</span>
                  <b>{money(order.totalCents)}</b>
                </li>
              </ul>
            )}
            {order && (
              <div className="success-ship">
                <span>Teslimat</span>
                <strong>{order.customerName}</strong>
                {order.customerPhone && <em>{order.customerPhone}</em>}
                {order.shippingAddress && <em>{order.shippingAddress}</em>}
              </div>
            )}
            <div className="success-actions">
              <Link className="primary-cta" href="/koleksiyon">Koleksiyona dön <ArrowRight size={15} /></Link>
            </div>
          </div>
        </section>
      </PageRise>
    </StoreLayout>
  );
}
