import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { money } from "@/components/ProductCard";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { useCart } from "@/contexts/CartContext";
import { forgetCheckoutOrder } from "@/lib/checkoutOrder";
import { trpc } from "@/lib/trpc";

export default function OrderSuccess() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("order") ?? "";
  const sessionId = params.get("session_id") ?? "";
  const { clear } = useCart();
  const utils = trpc.useUtils();
  const cleared = useRef(false);
  const started = useRef(false);
  const confirm = trpc.order.confirmPayment.useMutation({
    onSuccess: () => utils.order.byNumber.invalidate({ orderNumber }),
  });
  const { data: order } = trpc.order.byNumber.useQuery(
    { orderNumber },
    { enabled: Boolean(orderNumber), refetchInterval: 2000 },
  );

  useEffect(() => {
    forgetCheckoutOrder();
  }, []);

  useEffect(() => {
    if (!orderNumber || !order || order.status !== "pending" || started.current) return;
    started.current = true;
    confirm.mutate({ orderNumber, sessionId: sessionId || undefined });
  }, [confirm, order, orderNumber, sessionId]);

  useEffect(() => {
    if (order?.status !== "paid" || cleared.current) return;
    cleared.current = true;
    clear();
  }, [clear, order?.status]);

  const paid = order?.status === "paid";

  return (
    <StoreLayout>
      <PageRise>
        <section className="success-page">
          <div className="success-card">
            <div className="success-icon"><Check size={28} /></div>
            <span className="eyebrow">Carmen Antika / Sipariş</span>
            <h1>Siparişin <em>başarılı.</em></h1>
            <p>
              {paid
                ? "Ödemen alındı. Parçanı Antalya'dan özenle paketleyip yola çıkaracağız."
                : "Ödemen iyzico'da tamamlandı. Parçanı hazırlıyoruz; bu ekran birkaç saniye içinde kesinleşecek."}
            </p>
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
              </ul>
            )}
            {order && (
              <p className="success-ship">
                {[order.customerName, order.customerPhone].filter(Boolean).join(" · ")}
                {typeof order.totalCents === "number" ? ` · ${money(order.totalCents)}` : ""}
              </p>
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
