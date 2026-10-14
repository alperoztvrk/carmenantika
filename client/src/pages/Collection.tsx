import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Collection() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/", { replace: true });
    const scroll = () => document.getElementById("koleksiyon")?.scrollIntoView({ behavior: "auto", block: "start" });
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  }, [navigate]);

  return null;
}
