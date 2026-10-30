import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, errorMessage, session, type Product, type User } from './api';

interface AuthState { user: User | null; loading: boolean; error: string; login: (email: string, password: string) => Promise<void>; logout: () => void }
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const token = session.get();
      if (!token) { if (active) { setUser(null); setLoading(false); } return; }
      try { const value = await api.me(); if (active && session.get() === token) { setUser(value); setError(''); } }
      catch (err) { if (active && session.get() === token) setError(errorMessage(err)); }
      finally { if (active) setLoading(false); }
    };
    const expired = () => { setUser(null); setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); };
    window.addEventListener('myshop:unauthorized', expired);
    window.addEventListener('focus', refresh);
    void refresh();
    return () => { active = false; window.removeEventListener('myshop:unauthorized', expired); window.removeEventListener('focus', refresh); };
  }, []);
  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    session.set(result.access_token);
    try { setUser(await api.me()); setError(''); }
    catch (err) { session.clear(); setUser(null); throw err; }
  };
  const logout = () => { session.clear(); setUser(null); setError(''); };
  return <AuthContext.Provider value={{ user, loading, error, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider is required'); return context; }

export interface Line { productId: number; quantity: number }
interface CartState { lines: Line[]; count: number; add: (product: Product, quantity?: number) => void; update: (id: number, quantity: number) => void; remove: (id: number) => void; clear: () => void }
const CartContext = createContext<CartState | null>(null);
function read(key: string): Line[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<number>();
    return value.filter((line): line is Line => {
      if (typeof line !== 'object' || line === null || !Number.isSafeInteger(line.productId) || line.productId < 1 ||
          !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99 || seen.has(line.productId)) return false;
      seen.add(line.productId); return true;
    });
  } catch { return []; }
}
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const key = `myshop.cart.v1.${user ? `user-${user.id}` : 'guest'}`;
  const [revision, setRevision] = useState(0);
  const lines = useMemo(() => loading ? [] : read(key), [key, loading, revision]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key) setRevision(value => value + 1); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, [key]);
  const save = (next: Line[]) => { try { localStorage.setItem(key, JSON.stringify(next)); } catch { throw new Error('Không lưu được giỏ hàng trong trình duyệt.'); } setRevision(value => value + 1); };
  const add = (product: Product, quantity = 1) => {
    if (loading || !product.active || product.quantity < 1) throw new Error('Sản phẩm hiện không thể mua.');
    const next = (lines.find(line => line.productId === product.id)?.quantity ?? 0) + quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || next > 99 || next > product.quantity) throw new Error('Số lượng vượt quá tồn kho.');
    save([...lines.filter(line => line.productId !== product.id), { productId: product.id, quantity: next }]);
  };
  return <CartContext.Provider value={{ lines, count: lines.reduce((sum, line) => sum + line.quantity, 0), add,
    update: (id, quantity) => { if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Số lượng phải từ 1 đến 99.'); save(lines.map(line => line.productId === id ? { ...line, quantity } : line)); },
    remove: id => save(lines.filter(line => line.productId !== id)), clear: () => save([]) }}>{children}</CartContext.Provider>;
}
export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('CartProvider is required'); return context; }
