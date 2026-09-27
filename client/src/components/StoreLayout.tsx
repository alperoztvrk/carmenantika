import { StoreFooter } from "@/components/StoreFooter";
import { StoreHeader } from "@/components/StoreHeader";
import { useScrollMotion } from "@/hooks/useScrollMotion";
import { useLocation } from "wouter";

export function StoreLayout({ children }: { children: React.ReactNode }) {
  useScrollMotion();
  const [location] = useLocation();
  return <div className="site-shell paper-texture"><StoreHeader /><main key={location} className="page-transition">{children}</main><StoreFooter /></div>;
}
