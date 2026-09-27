import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type Phase = "idle" | "covering" | "revealing";

let openWithCurtain: ((href: string) => void) | null = null;

export function goWithCurtain(href: string) {
  if (openWithCurtain) openWithCurtain(href);
  else window.location.assign(href);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PageCurtain() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const busy = useRef(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const release = () => {
      busy.current = false;
      setPhase("idle");
    };
    const start = (href: string) => {
      const nextUrl = new URL(href, window.location.origin);
      const next = `${nextUrl.pathname}${nextUrl.search}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (next === current) return;
      if (prefersReducedMotion()) {
        navigateRef.current(next);
        window.scrollTo(0, 0);
        return;
      }
      if (busy.current) return;
      busy.current = true;
      setPhase("covering");
      later(() => {
        navigateRef.current(next);
        window.scrollTo(0, 0);
        setPhase("revealing");
        later(release, 820);
      }, 520);
    };

    openWithCurtain = start;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.getAttribute("target") === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      start(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      document.removeEventListener("click", onClick, true);
      if (openWithCurtain === start) openWithCurtain = null;
    };
  }, []);

  return (
    <div className={`page-curtain ${phase}`} aria-hidden={phase === "idle"}>
      <span className="page-curtain-panel page-curtain-top" />
      <span className="page-curtain-panel page-curtain-bottom" />
      <em className="page-curtain-mark">Carmen Antika</em>
    </div>
  );
}
