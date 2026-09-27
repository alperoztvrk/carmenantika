import { motion } from "framer-motion";

const ease = [0.22, 0.8, 0.24, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

export const heroItem = {
  hidden: { opacity: 0, y: -36, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.78, ease } },
};

export function HeroEnter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={stagger}>
      {children}
    </motion.div>
  );
}

export function PageRise({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.62, delay, ease }}>
      {children}
    </motion.div>
  );
}
