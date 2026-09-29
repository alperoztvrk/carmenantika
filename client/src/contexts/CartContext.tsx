import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type CartProduct = {
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  shortDescription: string;
};

export type CartLine = CartProduct & { expiresAt: number };

export type CartCatalogProduct = CartProduct & { isAvailable: number };

export function reconcileCart(items: CartLine[], products: CartCatalogProduct[], keepHeld: boolean, protectIds?: ReadonlySet<number>) {
  const byId = new Map(products.map((product) => [product.id, product]));
  let changed = false;
  const removed: CartLine[] = [];
  const next = items.flatMap((item) => {
    const product = byId.get(item.id);
    const protectedLine = protectIds?.has(item.id) ?? false;
    if (protectedLine && !product) return [item];
    if (!product || (product.isAvailable !== 1 && !keepHeld && !protectedLine)) {
      changed = true;
      removed.push(item);
      return [];
    }
    const updated: CartLine = {
      ...item,
      slug: product.slug,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      shortDescription: product.shortDescription,
    };
    if (
      updated.slug !== item.slug
      || updated.name !== item.name
      || updated.priceCents !== item.priceCents
      || updated.imageUrl !== item.imageUrl
      || updated.shortDescription !== item.shortDescription
    ) {
      changed = true;
    }
    return [updated];
  });
  return { items: changed ? next : items, removed };
}

type CartContextValue = {
  items: CartLine[];
  totalCents: number;
  addItem: (product: CartProduct) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  hasItem: (productId: number) => boolean;
  beginCheckoutHold: (productIds: number[]) => void;
  endCheckoutHold: () => void;
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
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const present = trpc.product.present.useQuery({ ids }, { enabled: ids.length > 0, refetchInterval: 4000 });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const announced = useRef("");
  const protectRef = useRef<Set<number>>(new Set());
  const [protectVersion, setProtectVersion] = useState(0);
  const beginCheckoutHold = (productIds: number[]) => {
    protectRef.current = new Set(productIds);
    setProtectVersion((version) => version + 1);
  };
  const endCheckoutHold = () => {
    if (protectRef.current.size === 0) return;
    protectRef.current = new Set();
    setProtectVersion((version) => version + 1);
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!present.data || ids.length === 0 || present.isFetching) return;
    const requested = new Set(ids);
    const current = itemsRef.current;
    const known = current.filter((item) => requested.has(item.id));
    const extra = current.filter((item) => !requested.has(item.id));
    const keepHeld = Boolean(new URLSearchParams(window.location.search).get("iptal"));
    const result = reconcileCart(known, present.data, keepHeld, protectRef.current);
    const next = extra.length > 0 ? [...result.items, ...extra] : result.items;
    const same = next.length === current.length && next.every((item, index) => item === current[index]);
    if (!same) setItems(next);
    const signature = result.removed.map((item) => item.id).join(",");
    if (!signature) {
      announced.current = "";
      return;
    }
    if (announced.current === signature) return;
    announced.current = signature;
    toast(result.removed.length === 1 ? `${result.removed[0].name} artık yok. Çantadan çıkarıldı.` : "Artık satılmayan parçalar çantadan çıkarıldı.");
  }, [ids, present.data, present.isFetching, protectVersion]);

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
    beginCheckoutHold,
    endCheckoutHold,
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
