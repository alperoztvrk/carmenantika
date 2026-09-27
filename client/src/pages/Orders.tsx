import { ArrowRight, Clock3, LogIn, PackageCheck, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { trpc } from "@/lib/trpc";

export default function Orders() {
  const { user, loading } = useAuth();
  const { data: orders, isLoading } = trpc.order.mine.useQuery(undefined, { enabled: Boolean(user) });
  if (loading) return <StoreLayout><div className="detail-state">Siparişlerin açılıyor...</div></StoreLayout>;
  if (!user) return <StoreLayout><div className="admin-state"><LogIn size={24} /><h1>Sipariş geçmişi için giriş yapmalısın.</h1><p>Ödeme sırasında kullandığın Carmen hesabıyla giriş yaptığında siparişlerini burada görebilirsin.</p></div></StoreLayout>;
  return <StoreLayout><PageRise><section className="orders-page"><div className="container-carmen"><div className="orders-heading"><span className="eyebrow">Carmen Antika / Hesabım</span><h1>Sipariş <em>geçmişin.</em></h1><p>Parçalarının yolculuğu burada.</p></div>{isLoading ? <div className="catalog-state">Siparişler yükleniyor...</div> : (orders ?? []).length === 0 ? <div className="empty-checkout"><PackageCheck size={30} /><h2>Henüz sipariş yok.</h2><p>İlk parçanı keşfetmeye ne dersin?</p><Link className="primary-cta" href="/koleksiyon">Koleksiyona git <ArrowRight size={15} /></Link></div> : <div className="orders-list">{orders?.map((order) => <article className="order-row" key={order.id}><div className="order-row-icon">{order.status === "paid" ? <PackageCheck size={20} /> : <Clock3 size={20} />}</div><div><strong>{order.orderNumber}</strong><span>{new Date(order.createdAt).toLocaleDateString("tr-TR")} · {order.customerPhone || order.customerEmail}</span></div><b>{(order.totalCents / 100).toLocaleString("tr-TR")} ₺</b><em>{order.status}</em></article>)}</div>}</div></section></PageRise></StoreLayout>;
}
