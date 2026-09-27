import { useEffect } from "react";

export function useReveal(dependency?: unknown) {
  useEffect(() => {
    document.documentElement.classList.add("has-motion");
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [dependency]);
}
