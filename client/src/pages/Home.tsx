import { MotionConfig, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { CollectionCatalog } from "@/components/CollectionCatalog";
import { HomeReviewForm, ReviewTicker } from "@/components/HomeReviews";
import { HeroEnter, heroItem } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";
import { scrollToCollection } from "@/lib/shop";

const ease = [0.22, 0.8, 0.24, 1] as const;

export default function Home() {
  useEffect(() => {
    if (window.location.hash === "#koleksiyon" || new URLSearchParams(window.location.search).has("q")) {
      const timer = window.setTimeout(scrollToCollection, 80);
      return () => window.clearTimeout(timer);
    }
  }, []);

  return (
    <StoreLayout>
      <MotionConfig reducedMotion="never">
      <section className="hero hero-only">
        <div className="container-carmen hero-grid">
          <HeroEnter className="hero-copy">
            <motion.div className="hero-brand" variants={heroItem}>
              <img src="/brand/carmen-lockup.png?v=5" alt="Carmen Antika" width="1224" height="1224" />
            </motion.div>
            <motion.h1 className="hero-title serif text-balance" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}>
              <motion.span className="hero-line" variants={heroItem}>Geçmişten gelen,</motion.span>
              <motion.span className="hero-line" variants={heroItem}><em>bugün</em> için seçilmiş.</motion.span>
            </motion.h1>
            <motion.div className="cta-row" variants={heroItem}>
              <a className="primary-cta" href="#koleksiyon">Koleksiyonu keşfet <ArrowRight size={15} /></a>
            </motion.div>
          </HeroEnter>
          <div className="hero-visual" data-parallax="0.05">
            <motion.div className="hero-photo" initial={{ y: 18 }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease }}>
              <img src="/photos/hero-stall.jpg" alt="Carmen Antika vitrininden seçilmiş antika parçalar" />
            </motion.div>
            <motion.div className="hero-stamp" initial={{ scale: 0.92, rotate: 6 }} animate={{ scale: 1, rotate: 12 }} transition={{ duration: 0.7, delay: 0.2, ease }}>
              <span>One of<br />a kind<br />objects</span>
            </motion.div>
            <motion.div className="hero-caption" initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.16, ease }}>
              <p>Bir ev, seçtiği parçalar kadar kendisidir.</p>
              <small>Antalya</small>
            </motion.div>
          </div>
        </div>
        <ReviewTicker />
      </section>
      <CollectionCatalog />
      <HomeReviewForm />
      </MotionConfig>
    </StoreLayout>
  );
}
