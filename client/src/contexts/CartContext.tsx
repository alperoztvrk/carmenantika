import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartProduct = {
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  shortDescription: string;
};

export type CartLine = CartProduct & { expiresAt: number };

type CartContextValue = {
  items: CartLine[];
  totalCents: number;
  addItem: (product: CartProduct) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  hasItem: (productId: number) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "carmen-antika-cart";
export const CART_HOLD_MS = 30 * 60 * 1000;

export function holdLabel(expiresAt: number, now = Date.now()) {
  const minutes = Math.max(1, Math.ceil((expiresAt - now) / 60000 - 0.02));
  return `${minutes} dk içinde kalkar`;
}

function readCart(): CartLine[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as CartLine[];
    if (!Array.isArray(stored)) return [];
    const now = Date.now();
    return stored.filter((item) => item && typeof item.id === "number" && typeof item.expiresAt === "number" && item.expiresAt > now);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(readCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setItems((current) => {
        const next = current.filter((item) => item.expiresAt > now);
        return next.length === current.length ? current : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    totalCents: items.reduce((total, item) => total + item.priceCents, 0),
    addItem: (product) => setItems((current) => current.some((item) => item.id === product.id) ? current : [...current, { ...product, expiresAt: Date.now() + CART_HOLD_MS }]),
    removeItem: (productId) => setItems((current) => current.filter((item) => item.id !== productId)),
    clear: () => setItems([]),
    hasItem: (productId) => items.some((item) => item.id === productId),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
