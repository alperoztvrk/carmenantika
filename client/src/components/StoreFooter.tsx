import { MotionConfig, motion } from "framer-motion";
import { Link } from "wouter";

const ease = [0.22, 0.8, 0.24, 1] as const;

export function StoreFooter() {
  return (
    <MotionConfig reducedMotion="never">
    <motion.footer
      className="site-footer"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
    >
      <div className="container-carmen">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">Carmen Antika</div>
            <p className="footer-note">Bit pazarlarından, eski dükkânlardan ve unutulmuş çekmecelerden seçilen tekil parçalar.</p>
          </div>
          <div className="footer-col">
            <h3>Keşfet</h3>
            <Link href="/koleksiyon">Koleksiyon</Link>
            <Link href="/hikayemiz">Hikâyemiz</Link>
            <Link href="/siparislerim">Siparişlerim</Link>
          </div>
          <div className="footer-col">
            <h3>Bilgi</h3>
            <Link href="/kargo">Kargo & teslimat</Link>
            <Link href="/iade">İade koşulları</Link>
            <Link href="/iletisim">İletişim</Link>
            <Link href="/admin">Yönetim</Link>
          </div>
          <div className="footer-col">
            <h3>Bizi bul</h3>
            <p>Konyaaltı, Antalya</p>
            <a href="mailto:merhaba@carmenantika.com">merhaba@carmenantika.com</a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram ↗</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2024 Carmen Antika. Her parça tek.</span>
          <span>Made with patience in Antalya. · Görseller Wikimedia Commons</span>
        </div>
      </div>
    </motion.footer>
    </MotionConfig>
  );
}
