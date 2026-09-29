import { motion } from "framer-motion";

const ease = [0.22, 0.8, 0.24, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

export const heroItem = {
  hidden: { y: 10 },
  show: { y: 0, transition: { duration: 0.55, ease } },
};

export function HeroEnter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={stagger}>
      {children}
    </motion.div>
  );
}

export function PageRise({ children }: { children: React.ReactNode; delay?: number }) {
  return <>{children}</>;
}
