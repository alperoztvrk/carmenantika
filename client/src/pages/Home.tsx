import { MotionConfig, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { HomeReviewForm, ReviewTicker } from "@/components/HomeReviews";
import { HeroEnter, heroItem } from "@/components/PageMotion";
import { StoreLayout } from "@/components/StoreLayout";

export default function Home() {
  return (
    <StoreLayout>
      <MotionConfig reducedMotion="never">
      <section className="hero hero-only">
        <div className="container-carmen hero-grid">
          <HeroEnter className="hero-copy">
            <motion.div className="hero-brand" variants={heroItem}>
              <img src="/brand/carmen-lockup.png" alt="Carmen Antika" width="1001" height="1006" />
            </motion.div>
            <motion.h1 className="hero-title serif text-balance" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}>
              <motion.span className="hero-line" variants={heroItem}>Geçmişten gelen,</motion.span>
              <motion.span className="hero-line" variants={heroItem}><em>bugün</em> için seçilmiş.</motion.span>
            </motion.h1>
            <motion.div className="cta-row" variants={heroItem}>
              <Link className="primary-cta" href="/koleksiyon">Koleksiyonu keşfet <ArrowRight size={15} /></Link>
              <Link className="outline-cta" href="/hikayemiz">Hikâyemiz</Link>
            </motion.div>
          </HeroEnter>
        </div>
        <ReviewTicker />
      </section>
      <HomeReviewForm />
      </MotionConfig>
    </StoreLayout>
  );
}
