import { MotionConfig, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { HeroEnter, heroItem } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";

const ease = [0.22, 0.8, 0.24, 1] as const;

export default function Home() {
  return (
    <StoreLayout>
      <MotionConfig reducedMotion="never">
      <section className="hero hero-only">
        <div className="container-carmen hero-grid">
          <HeroEnter className="hero-copy">
            <motion.div className="hero-kicker eyebrow" variants={heroItem}>Yeni bir hikâyeye yer aç</motion.div>
            <motion.h1 className="hero-title serif text-balance" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}>
              <motion.span className="hero-line" variants={heroItem}>Geçmişten gelen,</motion.span>
              <motion.span className="hero-line" variants={heroItem}><em>bugün</em> için seçilmiş.</motion.span>
            </motion.h1>
            <motion.p className="hero-intro" variants={heroItem}>
              Carmen Antika, bit pazarlarından ve eski dükkânlardan bulunan ikinci el radyo, oyuncak, kamera ve küçük tuhaflıkları yeni sahipleriyle buluşturur. Her parça tek, her iz gerçek.
            </motion.p>
            <motion.div className="cta-row" variants={heroItem}>
              <Link className="primary-cta" href="/koleksiyon">Koleksiyonu keşfet <ArrowRight size={15} /></Link>
              <Link className="outline-cta" href="/hikayemiz">Bizim hikâyemiz</Link>
            </motion.div>
            <motion.div className="hero-note" variants={heroItem}>
              <strong>01</strong>
              <span>Bu ayın teması<br />Pazardan eve, iyi bulunmuş</span>
            </motion.div>
          </HeroEnter>
          <div className="hero-visual" data-parallax="0.05">
            <motion.div className="hero-photo" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.95, delay: 0.16, ease }}>
              <img src="/photos/hero-stall.jpg" alt="Bit pazarında eski eşyaların dizildiği tezgâh" />
            </motion.div>
            <motion.div className="hero-stamp" initial={{ opacity: 0, scale: 0.9, rotate: 4 }} animate={{ opacity: 1, scale: 1, rotate: 12 }} transition={{ duration: 0.75, delay: 0.55, ease }}>
              <span>One of<br />a kind<br />objects</span>
            </motion.div>
            <motion.div className="hero-caption" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.72, ease }}>
              <p>Bir ev, seçtiği parçalar kadar kendisidir.</p>
              <small>— Carmen Antika notları, no. 01</small>
            </motion.div>
          </div>
        </div>
      </section>
      </MotionConfig>
    </StoreLayout>
  );
}
