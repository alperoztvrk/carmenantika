import { useEffect } from "react";

const SELECTOR = "[data-reveal], .motion-reveal, .motion-clip, .motion-stagger, .scroll-stage";

function placement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight || 1;
  if (rect.width < 2 || rect.height < 2) return "out";
  if (rect.bottom < 12 || rect.top > viewport - 12) return "out";
  const shown = Math.min(rect.bottom, viewport * 0.94) - Math.max(rect.top, viewport * 0.05);
  if (shown > Math.min(88, rect.height * 0.18)) return "in";
  return "edge";
}

export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("has-motion");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = () => Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((element) => {
      const stage = element.closest(".scroll-stage");
      return !stage || stage === element;
    });

    const showAll = () => nodes().forEach((element) => element.classList.add("is-visible", "is-in"));
    if (reduce) {
      showAll();
      const mutations = new MutationObserver(showAll);
      mutations.observe(document.body, { childList: true, subtree: true });
      return () => mutations.disconnect();
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      nodes().forEach((element) => {
        const where = placement(element);
        if (where === "in") element.classList.add("is-visible", "is-in");
        else if (where === "out") element.classList.remove("is-visible", "is-in");
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
}
