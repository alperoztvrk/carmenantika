import { ArrowRight, Compass, Heart, Search, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { StoreLayout } from "@/components/StoreLayout";

export default function Story() {
  return (
    <StoreLayout>
      <section className="story-page-hero enter-from-bar">
        <div className="container-carmen story-page-intro">
          <div>
            <span className="eyebrow">Carmen Antika / Hikâyemiz</span>
            <h1 className="split-lines">
              <span>Eşya değil,</span>
              <span><em>iz</em> biriktiriyoruz.</span>
            </h1>
          </div>
          <p>
            Antalya'nın farklı köşelerindeki bit pazarlarını, eski dükkânları ve unutulmuş çekmeceleri geziyoruz. Bazen bir radyo, bazen kurmalı bir oyuncak, bazen de ne işe yaradığını bilmediğimiz bir parça buluyoruz.
          </p>
        </div>
      </section>

      <section className="story-page-grid container-carmen scroll-stage">
        <div className="story-page-image motion-clip">
          <img src="/photos/story-market.jpg" alt="Bit pazarında bulunan eski vazolar ve küçük objeler" />
        </div>
        <div className="story-page-copy motion-stagger">
          <span className="eyebrow">01 / Bulmak</span>
          <h2 className="split-lines">
            <span>Gözden kaçanı</span>
            <span><em>görmek.</em></span>
          </h2>
          <p>
            Bizim için iyi bir parça kusursuz değil; kendinden önceki hayatını biraz belli eden parça. Tezgâhın kalabalığında, eski bir dükkânın rafında veya bir evin taşınma kolisinde karşılaşırız.
          </p>
          <div className="story-pillars motion-stagger">
            <span><Compass size={16} /> Şehrin içinden</span>
            <span><Search size={16} /> Araştırılmış</span>
            <span><Heart size={16} /> Sevgiyle seçilmiş</span>
          </div>
        </div>
      </section>

      <section className="story-chapter scroll-stage">
        <div className="container-carmen story-chapter-grid">
          <div className="story-chapter-copy motion-stagger">
            <span className="eyebrow">02 / Seçmek</span>
            <h2 className="split-lines">
              <span>Her iz</span>
              <span><em>bir cümle.</em></span>
            </h2>
            <p>
              Radyonun kadranındaki sararma, oyuncağın yayı, kameranın derisindeki çizik: hepsi bir önceki evden kalan not. Biz o notu silmeyiz, sadece yeni bir cümleye yer açarız.
            </p>
            <p>Parça buraya geldiğinde temizlenir, kondisyonu yazılır ve tek olduğu için bir daha aynı rafta durmaz.</p>
          </div>
          <div className="story-chapter-photos">
            <figure className="motion-clip story-float">
              <img src="/photos/radio.jpg" alt="Eski bir masa radyosu" />
              <figcaption>Radyo, Offenburg</figcaption>
            </figure>
            <figure className="motion-clip story-float story-float-late">
              <img src="/photos/typewriter.jpg" alt="Eski bir daktilonun tuşları" />
              <figcaption>Mektupluk tuşlar</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="story-quote-band scroll-stage">
        <div className="container-carmen motion-stagger">
          <Sparkles size={20} />
          <blockquote>“İyi bulunan bir şey, sahibini de bulur.”</blockquote>
          <span>Carmen'in defterinden</span>
        </div>
      </section>

      <section className="story-page-cta scroll-stage">
        <div className="container-carmen motion-stagger">
          <span className="eyebrow">Sıradaki hikâye</span>
          <h2 className="split-lines">
            <span>Belki bugün</span>
            <span><em>senin evindedir.</em></span>
          </h2>
          <Link className="primary-cta" href="/koleksiyon">Koleksiyona git <ArrowRight size={15} /></Link>
        </div>
      </section>
    </StoreLayout>
  );
}
