import { ArrowLeft, ArrowRight, Phone } from "lucide-react";
import { Link } from "wouter";
import { PageRise } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { SHOP_EMAIL, SHOP_MAILTO, SHOP_PHONE, SHOP_PHONE_TEL } from "@/lib/shop";

const content: Record<string, { label: string; title: string; text: string }> = {
  kargo: {
    label: "Bilgi / Kargo",
    title: "Parçan özenle yola çıkar.",
    text: "Siparişlerin ödemeden sonra 2–4 iş günü içinde hazırlanır. Antalya içi elden teslim. Şehir dışı kargo ücreti müşteriye aittir. Takip ve sorular için 0552 442 42 28.",
  },
  iade: {
    label: "Bilgi / İade",
    title: "İçine sinmeyen parça olmasın.",
    text: "Kondisyonu ürün sayfasında açıkça yazarız. İade ve ürün özelindeki sorular için sipariş numaranla 0552 442 42 28’i ara veya merhaba@carmenantika.com adresine yaz.",
  },
  iletisim: {
    label: "Carmen Antika / İletişim",
    title: "Soru, pazarlık, sipariş.",
    text: "Bir parça hakkında konuşmak, fiyat netleştirmek veya teslimatı sormak için ara. Aynı numara WhatsApp ve arama için geçerlidir.",
  },
};

export default function InfoPage({ params }: { params: { topic?: string } }) {
  const topic = params.topic ?? "iletisim";
  const page = content[topic] ?? content.iletisim;
  const contact = topic === "iletisim";
  return (
    <StoreLayout>
      <PageRise>
        <section className="info-page">
          <div className="container-carmen">
            <Link href="/" className="info-back"><ArrowLeft size={15} /> Ana sayfaya dön</Link>
            <span className="eyebrow">{page.label}</span>
            <h1>{page.title}</h1>
            <p>{page.text}</p>
            {contact && (
              <p className="info-phone">
                <a href={SHOP_PHONE_TEL}>{SHOP_PHONE}</a>
                <span>Antalya · soru ve pazarlık</span>
              </p>
            )}
            <div className="info-actions">
              <a className="primary-cta" href={SHOP_PHONE_TEL}><Phone size={15} /> Ara: {SHOP_PHONE}</a>
              <a className="outline-cta" href={SHOP_MAILTO}>{SHOP_EMAIL} <ArrowRight size={15} /></a>
            </div>
          </div>
        </section>
      </PageRise>
    </StoreLayout>
  );
}
