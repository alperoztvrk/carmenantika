import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";

const content: Record<string, { label: string; title: string; text: string }> = {
  kargo: { label: "Bilgi / Kargo", title: "Parçan özenle yola çıkar.", text: "Siparişlerin ödemeden sonra 2–4 iş günü içinde hazırlanır. Antalya içi elden teslim. Şehir dışı kargo ücreti müşteriye aittir. Takip için sipariş numaran ve telefonun yeter." },
  iade: { label: "Bilgi / İade", title: "İçine sinmeyen parça olmasın.", text: "Ürünün kondisyonunu ve hikâyesini her detayına kadar paylaşırız. İade koşulları ve ürün özelindeki uygunluk için sipariş numaranla bize merhaba@carmenantika.com adresinden ulaşabilirsin." },
  iletisim: { label: "Carmen Antika / İletişim", title: "Bir parça mı arıyorsun?", text: "Eski bir radyon, oyuncak kameran veya hikâyesi olan bir objen mi var? Bize yaz; bit pazarı hikâyelerini dinlemeyi seviyoruz." },
};

export default function InfoPage({ params }: { params: { topic?: string } }) {
  const page = content[params.topic ?? "iletisim"] ?? content.iletisim;
  return <StoreLayout><PageRise><section className="info-page"><div className="container-carmen"><Link href="/" className="info-back"><ArrowLeft size={15} /> Ana sayfaya dön</Link><span className="eyebrow">{page.label}</span><h1>{page.title}</h1><p>{page.text}</p><a className="primary-cta" href="mailto:merhaba@carmenantika.com">Bize yaz <ArrowRight size={15} /></a></div></section></PageRise></StoreLayout>;
}
