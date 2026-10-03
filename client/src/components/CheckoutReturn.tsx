import { useEffect } from "react";
import { useLocation } from "wouter";
import { peekCheckoutOrder } from "@/lib/checkoutOrder";

function fromIyzico() {
  try {
    return /iyzipay\.com/i.test(document.referrer);
  } catch {
    return false;
  }
}

export function CheckoutReturn() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location.startsWith("/siparis-basarili") || location.startsWith("/admin")) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("iptal")) return;
    const orderNumber = peekCheckoutOrder();
    if (!orderNumber || !fromIyzico()) return;
    if (location === "/" || location === "" || location.startsWith("/sepet")) {
      navigate(`/siparis-basarili?order=${encodeURIComponent(orderNumber)}`);
    }
  }, [location, navigate]);

  return null;
}
