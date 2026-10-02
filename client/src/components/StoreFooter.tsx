import { MotionConfig, motion } from "framer-motion";
import { Link } from "wouter";
import { SHOP_EMAIL, SHOP_MAILTO, SHOP_PHONE, SHOP_PHONE_TEL } from "@/lib/shop";

const ease = [0.22, 0.8, 0.24, 1] as const;

export function StoreFooter() {
  return (
    <MotionConfig reducedMotion="never">
    <motion.footer
      className="site-footer"
      initial={{ y: 18 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
    >
      <div className="container-carmen">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">Carmen Antika</div>
            <p className="footer-note">Antalya’dan seçilmiş ikinci el radyo, kamera, oyuncak ve objeler. Her parça tek.</p>
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
            <p>Antalya</p>
            <a href={SHOP_PHONE_TEL}>{SHOP_PHONE}</a>
            <a href={SHOP_MAILTO}>{SHOP_EMAIL}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Carmen Antika. Her parça tek.</span>
          <span>Antalya</span>
        </div>
      </div>
    </motion.footer>
    </MotionConfig>
  );
}
