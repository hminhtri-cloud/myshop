import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { api, errorMessage, formatPrice, type Order, type Product, type ProductInput } from './api';
import { Message } from './App';

export function AdminHome() {
  return <section className="page"><span className="eyebrow">GÓC QUẢN TRỊ</span><h1>Xin chào, chủ shop!</h1><p>Quản lý sản phẩm và xử lý đơn hàng tại một nơi.</p><div className="admin-links"><Link className="panel" to="/admin/products"><span className="eyebrow">01 · SẢN PHẨM</span><h2>Gian hàng của mình</h2><p>Thêm, sửa, ẩn/hiện sản phẩm và cập nhật tồn kho.</p><strong>Quản lý sản phẩm →</strong></Link><Link className="panel" to="/admin/orders"><span className="eyebrow">02 · ĐƠN HÀNG</span><h2>Đơn khách đã đặt</h2><p>Xem đơn hàng, xác nhận thanh toán và cập nhật trạng thái.</p><strong>Xem đơn hàng →</strong></Link></div></section>;
}

const blank: ProductInput = { name: '', description: '', category: '', price: '', quantity: 0, image_url: null, active: true };
export function AdminProducts() {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductInput>({ ...blank });
  const [editing, setEditing] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { let active = true; api.adminProducts().then(page => { if (active) setItems(page.items); }).catch(err => { if (active) setError(errorMessage(err)); }); return () => { active = false; }; }, [revision]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!/^\d+(\.\d{1,2})?$/.test(form.price) || Number(form.price) <= 0) { setError('Giá phải là số dương, tối đa 2 chữ số thập phân.'); return; }
    setBusy(true);
    try { const input = { ...form, name: form.name.trim(), description: form.description.trim(), category: form.category.trim(), image_url: form.image_url?.trim() || null };
      if (editing !== null) await api.updateProduct(editing, input); else await api.createProduct(input);
      setSuccess(editing !== null ? 'Đã cập nhật sản phẩm.' : 'Đã đăng sản phẩm.'); setEditing(null); setForm({ ...blank }); setRevision(value => value + 1);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function visibility(item: Product) {
    setBusy(true); setError('');
    try { await api.updateProduct(item.id, { name: item.name, description: item.description, category: item.category,
      price: item.price, quantity: item.quantity, image_url: item.image_url, active: !item.active });
      setRevision(value => value + 1);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <section className="page"><span className="eyebrow">QUẢN LÝ CỬA HÀNG</span><h1>Sản phẩm của mình.</h1><p>Chỉ tài khoản admin mới có thể đăng và chỉnh sửa sản phẩm.</p>{error && <Message>{error}</Message>}{success && <Message success>{success}</Message>}<div className="admin-grid"><form className="panel" onSubmit={save}><h2>{editing === null ? 'Đăng sản phẩm' : `Chỉnh sửa sản phẩm #${editing}`}</h2><fieldset disabled={busy}><label>Tên sản phẩm<input required minLength={3} maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Mô tả<textarea required minLength={10} maxLength={2000} rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><label>Danh mục<input required minLength={2} maxLength={60} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} /></label><div className="field-pair"><label>Giá (VND)<input required inputMode="decimal" placeholder="125000.00" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label><label>Số lượng<input required type="number" min="0" step="1" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></label></div><label>URL ảnh (không bắt buộc)<input type="url" maxLength={500} placeholder="https://..." value={form.image_url || ''} onChange={event => setForm({ ...form, image_url: event.target.value })} /></label><label className="checkbox"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} /> Hiển thị trên cửa hàng</label><div className="button-row"><button className="button primary">{busy ? 'Đang lưu…' : editing === null ? 'Đăng sản phẩm' : 'Lưu thay đổi'}</button>{editing !== null && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm({ ...blank }); }}>Hủy sửa</button>}</div></fieldset></form><div className="panel"><h2>Danh sách sản phẩm</h2>{items.length ? items.map(item => <div className="manage-item" key={item.id}><strong>{item.name}</strong><span>{formatPrice(item.price)} · Tồn: {item.quantity} · {item.active ? 'Đang hiển thị' : 'Đang ẩn'}</span><div className="button-row"><button className="button secondary small" disabled={busy} onClick={() => { setEditing(item.id); setForm({ name: item.name, description: item.description, category: item.category, price: item.price, quantity: item.quantity, image_url: item.image_url, active: item.active }); }}>Sửa</button><button className="button secondary small" disabled={busy} onClick={() => void visibility(item)}>{item.active ? 'Ẩn' : 'Hiện'}</button></div></div>) : <p>Chưa có sản phẩm. Đăng món đầu tiên để khách xem nhé.</p>}</div></div></section>;
}

const nextStatus: Partial<Record<Order['status'], 'confirmed' | 'shipping' | 'completed'>> = { pending: 'confirmed', confirmed: 'shipping', shipping: 'completed' };
const labels = { confirmed: 'Xác nhận', shipping: 'Bắt đầu giao', completed: 'Hoàn thành' };
export function AdminOrders() {
  const [items, setItems] = useState<Order[]>([]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { let active = true; api.adminOrders().then(value => { if (active) setItems(value); }).catch(err => { if (active) setError(errorMessage(err)); }); return () => { active = false; }; }, [revision]);
  async function advance(order: Order) {
    const status = nextStatus[order.status]; if (!status) return;
    setBusy(true); setError(''); setSuccess('');
    try { await api.advance(order.id, status); setSuccess(`Đã cập nhật đơn #${order.id}.`); setRevision(value => value + 1); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <section className="page"><span className="eyebrow">QUẢN LÝ CỬA HÀNG</span><h1>Đơn hàng.</h1><p>Xác nhận đơn đã thanh toán mô phỏng, cập nhật giao hàng cho khách.</p>{error && <Message>{error}</Message>}{success && <Message success>{success}</Message>}{items.length ? <div className="order-list">{items.map(order => <article className="panel order-admin" key={order.id}><div><strong>Đơn #{order.id} · Khách #{order.customer_id}</strong><p>{order.recipient_name} · {order.phone}<br />{order.address}</p><small>{order.items.map(item => `${item.product_name} × ${item.quantity}`).join(' · ')}</small></div><div className="order-right"><strong>{formatPrice(order.total)}</strong><span>{order.status} · {order.payment_status === 'paid' ? 'Đã thanh toán mô phỏng' : 'Chưa thanh toán'}</span>{nextStatus[order.status] && <button className="button primary small" disabled={busy || order.payment_status !== 'paid'} onClick={() => void advance(order)}>{labels[nextStatus[order.status]!]}</button>}</div></article>)}</div> : <div className="panel empty"><h2>Chưa có đơn hàng</h2><Link to="/admin/products">Quản lý sản phẩm →</Link></div>}</section>;
}
