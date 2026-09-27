import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

let openWithCurtain: ((href: string) => void) | null = null;

export function goWithCurtain(href: string) {
  if (openWithCurtain) openWithCurtain(href);
  else window.location.assign(href);
}

export function PageCurtain() {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const start = (href: string) => {
      const nextUrl = new URL(href, window.location.origin);
      const next = `${nextUrl.pathname}${nextUrl.search}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (next === current) return;
      navigateRef.current(next);
      window.scrollTo(0, 0);
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
      document.removeEventListener("click", onClick, true);
      if (openWithCurtain === start) openWithCurtain = null;
    };
  }, []);

  return null;
}
