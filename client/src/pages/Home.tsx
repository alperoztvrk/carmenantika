import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { StoreLayout } from "@/components/StoreLayout";

export default function Home() {
  return (
    <StoreLayout>
      <section className="hero hero-only">
        <div className="container-carmen hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker eyebrow motion-reveal">Yeni bir hikâyeye yer aç</div>
            <h1 className="hero-title serif text-balance motion-reveal split-lines">
              <span>Geçmişten gelen,</span>
              <span><em>bugün</em> için seçilmiş.</span>
            </h1>
            <p className="hero-intro motion-reveal" style={{ "--d": "160ms" } as React.CSSProperties}>
              Carmen Antika, bit pazarlarından ve eski dükkânlardan bulunan ikinci el radyo, oyuncak, kamera ve küçük tuhaflıkları yeni sahipleriyle buluşturur. Her parça tek, her iz gerçek.
            </p>
            <div className="cta-row motion-reveal" style={{ "--d": "240ms" } as React.CSSProperties}>
              <Link className="primary-cta" href="/koleksiyon">Koleksiyonu keşfet <ArrowRight size={15} /></Link>
              <Link className="outline-cta" href="/hikayemiz">Bizim hikâyemiz</Link>
            </div>
            <div className="hero-note motion-reveal" style={{ "--d": "320ms" } as React.CSSProperties}>
              <strong>01</strong>
              <span>Bu ayın teması<br />Pazardan eve, iyi bulunmuş</span>
            </div>
          </div>
          <div className="hero-visual" data-parallax="0.05">
            <div className="hero-photo motion-clip">
              <img src="/photos/hero-stall.jpg" alt="Bit pazarında eski eşyaların dizildiği tezgâh" />
            </div>
            <div className="hero-stamp motion-reveal" style={{ "--d": "280ms" } as React.CSSProperties}>
              <span>One of<br />a kind<br />objects</span>
            </div>
            <div className="hero-caption motion-reveal" style={{ "--d": "380ms" } as React.CSSProperties}>
              <p>Bir ev, seçtiği parçalar kadar kendisidir.</p>
              <small>— Carmen Antika notları, no. 01</small>
            </div>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}
