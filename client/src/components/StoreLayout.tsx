import { createContext, useContext } from "react";
import { StoreFooter } from "@/components/StoreFooter";
import { StoreHeader } from "@/components/StoreHeader";
import { useReveal } from "@/hooks/useReveal";
import { useScrollMotion } from "@/hooks/useScrollMotion";

const LayoutFrame = createContext(false);

export function StoreLayout({ children }: { children: React.ReactNode }) {
  const framed = useContext(LayoutFrame);
  if (framed) return <>{children}</>;
  return <StoreFrame>{children}</StoreFrame>;
}

function StoreFrame({ children }: { children: React.ReactNode }) {
  useScrollMotion();
  useReveal();

  return (
    <LayoutFrame.Provider value={true}>
      <div className="site-shell paper-texture">
        <StoreHeader />
        <main className="page-stage">{children}</main>
        <StoreFooter />
      </div>
    </LayoutFrame.Provider>
  );
}
