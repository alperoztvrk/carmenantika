import { useEffect } from "react";

const SELECTOR = "[data-reveal], .motion-reveal, .motion-clip, .motion-stagger, .scroll-stage";

export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("has-motion");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = () => Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((element) => {
      const stage = element.closest(".scroll-stage");
      return !stage || stage === element;
    });

    if (reduce) {
      nodes().forEach((element) => element.classList.add("is-visible", "is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const once = entry.target.classList.contains("scroll-stage");
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible", "is-in");
          } else if (!once) {
            entry.target.classList.remove("is-visible", "is-in");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    const watch = () => nodes().forEach((element) => observer.observe(element));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
}
