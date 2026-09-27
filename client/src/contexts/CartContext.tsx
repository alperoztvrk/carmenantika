import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartProduct = {
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  shortDescription: string;
};

type CartContextValue = {
  items: CartProduct[];
  totalCents: number;
  addItem: (product: CartProduct) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  hasItem: (productId: number) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "carmen-antika-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartProduct[]>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as CartProduct[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    totalCents: items.reduce((total, item) => total + item.priceCents, 0),
    addItem: (product) => setItems((current) => current.some((item) => item.id === product.id) ? current : [...current, product]),
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
