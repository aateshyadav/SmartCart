import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const EMPTY = { items: [], subtotal: 0, itemCount: 0 };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return setCart(EMPTY);
    try {
      setCart(await api.cart());
    } catch {
      setCart(EMPTY);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Each action returns the fresh cart from the server, so the UI never drifts from the truth
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      setCart(await fn());
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      cart,
      busy,
      refresh,
      add: (productId, qty = 1) => run(() => api.addToCart(productId, qty)),
      setQty: (productId, qty) => run(() => api.setCartQty(productId, qty)),
      remove: (productId) => run(() => api.removeFromCart(productId)),
    }),
    [cart, busy, refresh, run]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
