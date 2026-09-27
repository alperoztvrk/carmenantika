import { useEffect } from "react";

export function useScrollMotion() {
  useEffect(() => {
    let previous = window.scrollY;
    let ticking = false;
    const update = () => {
      const current = window.scrollY;
      const direction = current > previous && current > 70 ? "scroll-down" : current < previous ? "scroll-up" : "";
      if (direction) document.documentElement.classList.add(direction === "scroll-down" ? "scroll-down" : "scroll-up");
      if (direction) document.documentElement.classList.remove(direction === "scroll-down" ? "scroll-up" : "scroll-down");
      document.documentElement.style.setProperty("--scroll-progress", `${Math.min(current / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1), 1)}`);
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((element) => {
        const speed = Number(element.dataset.parallax ?? 0.05);
        const rect = element.getBoundingClientRect();
        const offset = (window.innerHeight / 2 - (rect.top + rect.height / 2)) * speed;
        element.style.setProperty("--parallax-offset", `${offset.toFixed(2)}px`);
      });
      previous = current;
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { window.requestAnimationFrame(update); ticking = true; } };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
}
