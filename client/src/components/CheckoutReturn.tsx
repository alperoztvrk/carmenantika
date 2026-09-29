import { useEffect } from "react";
import { useLocation } from "wouter";
import { peekCheckoutOrder } from "@/lib/checkoutOrder";

export function CheckoutReturn() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location.startsWith("/siparis-basarili") || location.startsWith("/admin")) return;
    const orderNumber = peekCheckoutOrder();
    if (!orderNumber) return;
    if (location === "/" || location === "") {
      navigate(`/siparis-basarili?order=${encodeURIComponent(orderNumber)}`);
    }
  }, [location, navigate]);

  return null;
}
