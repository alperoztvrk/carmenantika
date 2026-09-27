import { Check, Clock3, Package, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";

export default function OrderSuccess() {
  const orderNumber = new URLSearchParams(window.location.search).get("order") ?? "";
  const { data: order, isLoading } = trpc.order.byNumber.useQuery({ orderNumber }, { enabled: Boolean(orderNumber), refetchInterval: 3000 });
  return <StoreLayout><PageRise><section className="success-page"><div className="success-card"><div className="success-icon">{order?.status === "paid" ? <Check size={28} /> : <Clock3 size={28} />}</div><span className="eyebrow">Carmen Antika / Sipariş</span><h1>{order?.status === "paid" ? "Parçan senin." : "Siparişin alındı."}</h1><p>{order?.status === "paid" ? "Ödeme tamamlandı. Parçanı özenle hazırlayıp yola çıkaracağız." : "Ödeme doğrulanıyor. Bu ekran birkaç saniye içinde güncellenecek."}</p>{orderNumber && <div className="order-number"><span>Sipariş numarası</span><strong>{orderNumber}</strong></div>}<div className="success-actions"><Link className="primary-cta" href="/koleksiyon">Koleksiyona dön <ArrowRight size={15} /></Link><Link className="outline-cta" href="/siparislerim"><Package size={15} /> Siparişlerim</Link></div>{isLoading && <small>Ödeme durumu kontrol ediliyor...</small>}</div></section></PageRise></StoreLayout>;
}
