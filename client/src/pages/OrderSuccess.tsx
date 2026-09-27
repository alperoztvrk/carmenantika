import { ArrowRight, Check, Clock3, Package } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { useCart } from "@/contexts/CartContext";
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
  const { data: order, isLoading } = trpc.order.byNumber.useQuery(
    { orderNumber },
    { enabled: Boolean(orderNumber), refetchInterval: 2000 },
  );

  useEffect(() => {
    if (!orderNumber || !sessionId || started.current) return;
    started.current = true;
    confirm.mutate({ orderNumber, sessionId });
  }, [confirm, orderNumber, sessionId]);

  useEffect(() => {
    if (order?.status !== "paid" || cleared.current) return;
    cleared.current = true;
    clear();
  }, [clear, order?.status]);

  return <StoreLayout><PageRise><section className="success-page"><div className="success-card"><div className="success-icon">{order?.status === "paid" ? <Check size={28} /> : <Clock3 size={28} />}</div><span className="eyebrow">Carmen Antika / Sipariş</span><h1>{order?.status === "paid" ? "Parçan senin." : "Siparişin alındı."}</h1><p>{order?.status === "paid" ? "Ödeme tamamlandı. Parçanı özenle hazırlayıp yola çıkaracağız." : "Ödeme Stripe üzerinden doğrulanıyor. Bu ekran birkaç saniye içinde güncellenecek."}</p>{orderNumber && <div className="order-number"><span>Sipariş numarası</span><strong>{orderNumber}</strong></div>}{order?.customerPhone && <p>{order.customerName} · {order.customerPhone}</p>}<div className="success-actions"><Link className="primary-cta" href="/koleksiyon">Koleksiyona dön <ArrowRight size={15} /></Link><Link className="outline-cta" href="/siparislerim"><Package size={15} /> Siparişlerim</Link></div>{isLoading && <small>Ödeme durumu kontrol ediliyor...</small>}</div></section></PageRise></StoreLayout>;
}
