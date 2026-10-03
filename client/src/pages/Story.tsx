import { motion } from "framer-motion";
import { ArrowRight, Compass, Heart, Search, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { HeroEnter, heroItem } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";

const ease = [0.22, 0.8, 0.24, 1] as const;
const staggerBlock = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

function StoryStage({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      className={className}
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.22, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.75, delay, ease }}
    >
      {children}
    </motion.section>
  );
}

export default function Story() {
  return (
    <StoreLayout>
      <section className="story-page-hero">
        <HeroEnter className="container-carmen story-page-intro">
          <motion.div className="from-bar-copy" variants={staggerBlock}>
            <motion.span className="eyebrow" variants={heroItem}>Carmen Antika / Hikâyemiz</motion.span>
            <motion.h1 variants={staggerBlock}>
              <motion.span className="hero-line" variants={heroItem}>Eşya değil,</motion.span>
              <motion.span className="hero-line" variants={heroItem}><em>iz</em> biriktiriyoruz.</motion.span>
            </motion.h1>
            <motion.p variants={heroItem}>
              Antalya’da ikinci el radyo, oyuncak, kamera ve objeler seçiyoruz. Her parça tek; kondisyonu ve hikâyesi ürün sayfasında durur.
            </motion.p>
          </motion.div>
        </HeroEnter>
      </section>

      <StoryStage className="story-page-grid container-carmen">
        <div className="story-page-image">
          <img src="/photos/story-market.jpg" alt="Seçilmiş antika vazolar ve objeler" />
        </div>
        <div className="story-page-copy">
          <span className="eyebrow">01 / Bulmak</span>
          <h2 className="stacked-title">
            <span>Gözden kaçanı</span>
            <span><em>görmek.</em></span>
          </h2>
          <p>
            Bizim için iyi bir parça kusursuz değil; kendinden önceki hayatını biraz belli eden parça. Tezgâhın kalabalığında, eski bir dükkânın rafında veya bir evin taşınma kolisinde karşılaşırız.
          </p>
          <div className="story-pillars">
            <span><Compass size={16} /> Şehrin içinden</span>
            <span><Search size={16} /> Araştırılmış</span>
            <span><Heart size={16} /> Sevgiyle seçilmiş</span>
          </div>
        </div>
      </StoryStage>

      <StoryStage className="story-chapter" delay={0.08}>
        <div className="container-carmen story-chapter-grid">
          <div className="story-chapter-copy">
            <span className="eyebrow">02 / Seçmek</span>
            <h2 className="stacked-title">
              <span>Her iz</span>
              <span><em>bir cümle.</em></span>
            </h2>
            <p>
              Radyonun kadranındaki sararma, oyuncağın yayı, kameranın derisindeki çizik: hepsi bir önceki evden kalan not. Biz o notu silmeyiz, sadece yeni bir cümleye yer açarız.
            </p>
            <p>Parça buraya geldiğinde temizlenir, kondisyonu yazılır ve tek olduğu için bir daha aynı rafta durmaz.</p>
          </div>
          <div className="story-chapter-photos">
            <figure className="story-float">
              <img src="/photos/radio.jpg" alt="Eski bir masa radyosu" />
              <figcaption>Radyo, Offenburg</figcaption>
            </figure>
            <figure className="story-float story-float-late">
              <img src="/photos/typewriter.jpg" alt="Eski bir daktilonun tuşları" />
              <figcaption>Mektupluk tuşlar</figcaption>
            </figure>
          </div>
        </div>
      </StoryStage>

      <StoryStage className="story-quote-band" delay={0.06}>
        <div className="container-carmen">
          <Sparkles size={20} />
          <blockquote>“İyi bulunan bir şey, sahibini de bulur.”</blockquote>
          <span>Antalya</span>
        </div>
      </StoryStage>

      <StoryStage className="story-page-cta">
        <div className="container-carmen">
          <span className="eyebrow">Sıradaki hikâye</span>
          <h2 className="stacked-title">
            <span>Belki bugün</span>
            <span><em>senin evindedir.</em></span>
          </h2>
          <Link className="primary-cta" href="/koleksiyon">Koleksiyona git <ArrowRight size={15} /></Link>
        </div>
      </StoryStage>
    </StoreLayout>
  );
}
