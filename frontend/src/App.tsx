import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { session } from './api';
import { useAuth, useCart } from './state';
import { Home, Catalog, Detail, Cart, Checkout, Orders, OrderDetail, AuthPage } from './Shop';
import { AdminHome, AdminProducts, AdminOrders } from './Admin';

function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const adminArea = useLocation().pathname.startsWith('/admin');
  return <header className="header"><div className="container header-inner"><Link className="brand" to="/" aria-label="MyShop trang chủ"><span className="brand-mark">▢</span>my<span>shop.</span></Link>
    <nav aria-label="Điều hướng chính" className="primary-nav">{adminArea ? <Link to="/">← Về cửa hàng</Link> : <><NavLink end to="/">Trang chủ</NavLink><NavLink to="/products">Sản phẩm</NavLink><NavLink to="/cart">Giỏ hàng <span className="cart-count" aria-label={`${count} sản phẩm trong giỏ`}>{count}</span></NavLink>{user && <NavLink to="/orders">Đơn của tôi</NavLink>}{user?.role === 'admin' && <NavLink to="/admin">Quản trị</NavLink>}</>}</nav>
    <div className="header-actions">{user ? <><span className="username">{user.username}</span><button className="text-button" onClick={() => { logout(); navigate('/login'); }}>Đăng xuất</button></> : <><Link to="/login">Đăng nhập</Link><Link className="button primary small" to="/register">Đăng ký</Link></>}</div>
  </div></header>;
}

function Protected({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { user, loading, error } = useAuth();
  if (loading) return <p className="container page">Đang kiểm tra tài khoản…</p>;
  if (!user) {
    if (session.get() && error) return <div className="container page"><Message>{error}</Message><button className="button secondary" onClick={() => location.reload()}>Thử lại</button></div>;
    return <Navigate to="/login" replace />;
  }
  if (admin && user.role !== 'admin') return <div className="container page"><h1>Bạn không có quyền truy cập.</h1><Link to="/">Về cửa hàng</Link></div>;
  return <>{children}</>;
}

function AdminLayout() {
  return <div className="container workspace"><aside className="sidebar"><div className="eyebrow">QUẢN LÝ MYSHOP</div><h2>Cửa hàng của tôi</h2><nav aria-label="Menu quản trị"><NavLink to="/admin" end>Tổng quan</NavLink><NavLink to="/admin/products">Sản phẩm</NavLink><NavLink to="/admin/orders">Đơn hàng</NavLink></nav><Link className="sidebar-back" to="/products">← Xem cửa hàng</Link></aside><div className="workspace-main"><Outlet /></div></div>;
}

export function Message({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <div role={success ? 'status' : 'alert'} className={`message ${success ? 'success' : 'error'}`}>{children}</div>;
}

export function ProductImage({ name, src }: { name: string; src: string | null }) {
  return <div className="product-image">{src ? <img src={src} alt={name} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <span aria-label={`Chưa có ảnh: ${name}`}>▢</span>}</div>;
}

export default function App() {
  return <div className="app"><Header /><main><Routes>
    <Route path="/" element={<Home />} /><Route path="/products" element={<Catalog />} /><Route path="/products/:id" element={<Detail />} /><Route path="/cart" element={<Cart />} />
    <Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage register />} />
    <Route path="/checkout" element={<Protected><Checkout /></Protected>} /><Route path="/orders" element={<Protected><Orders /></Protected>} /><Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
    <Route element={<Protected admin><AdminLayout /></Protected>}><Route path="/admin" element={<AdminHome />} /><Route path="/admin/products" element={<AdminProducts />} /><Route path="/admin/orders" element={<AdminOrders />} /></Route>
    <Route path="*" element={<div className="container page"><h1>Trang không tồn tại</h1><Link to="/">Về trang chủ</Link></div>} />
  </Routes></main><footer><div className="container footer-inner"><strong>myshop.</strong><span>Một cửa hàng nhỏ, nhiều điều để khám phá.</span></div></footer></div>;
}
