import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { api, errorMessage, formatPrice, type Order, type Page, type Product } from './api';
import { useAuth, useCart } from './state';
import { Message, ProductImage } from './App';

function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [notice, setNotice] = useState('');
  return <article className="product-card"><Link to={`/products/${product.id}`}><ProductImage name={product.name} src={product.image_url} /><div className="product-body"><span className="eyebrow">{product.category}</span><h3>{product.name}</h3><strong>{formatPrice(product.price)}</strong><small>Còn {product.quantity} sản phẩm</small></div></Link><div className="product-card-footer"><button className="button secondary small" disabled={product.quantity < 1} onClick={() => { try { add(product); setNotice('Đã thêm vào giỏ.'); } catch (err) { setNotice(errorMessage(err)); } }}>Thêm vào giỏ</button>{notice && <span role="status">{notice}</span>}</div></article>;
}

export function Home() {
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; api.products().then(page => { if (active) setItems(page.items.slice(0, 4)); }).catch(err => { if (active) setError(errorMessage(err)); }); return () => { active = false; }; }, []);
  return <><section className="hero"><div className="container hero-inner"><div><span className="eyebrow">CHÀO MỪNG BẠN ĐẾN VỚI MYSHOP</span><h1>Những món đồ hay.<br /><span>Cho ngày của bạn.</span></h1><p>Khám phá sản phẩm mình chọn lọc và lưu món bạn thích vào giỏ. Mọi thứ thật đơn giản, từ chọn hàng đến đặt mua.</p><div className="button-row"><Link className="button primary" to="/products">Khám phá sản phẩm →</Link><Link className="button secondary" to="/cart">Giỏ hàng của tôi</Link></div></div><div className="hero-illustration" aria-hidden="true"><div className="hero-tile">▢<small>Tìm món đồ hợp ý</small></div><div className="hero-pill">✦ Được chọn bởi MyShop</div></div></div></section><section className="container page"><div className="section-title"><div><span className="eyebrow">VỪA LÊN KỆ</span><h2>Sản phẩm mới</h2></div><Link to="/products">Xem tất cả →</Link></div>{error && <Message>{error}</Message>}{items.length ? <div className="product-grid">{items.map(item => <ProductCard product={item} key={item.id} />)}</div> : <div className="empty panel"><h3>Đang chờ những sản phẩm đầu tiên</h3><p>Mình sẽ sớm giới thiệu các sản phẩm tại đây.</p></div>}</section></>;
}

export function Catalog() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Page<Product> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); setError(''); api.products(search, offset).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(errorMessage(err)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [search, offset]);
  return <section className="container page"><div className="section-title"><div><span className="eyebrow">CỬA HÀNG CỦA MÌNH</span><h1>Khám phá sản phẩm.</h1><p>Chọn một món đồ phù hợp với bạn.</p></div></div><form className="search-form" onSubmit={event => { event.preventDefault(); setOffset(0); setSearch(input.trim()); }}><input aria-label="Tìm sản phẩm" placeholder="Tìm theo tên sản phẩm…" value={input} maxLength={120} onChange={event => setInput(event.target.value)} /><button className="button primary">Tìm kiếm</button></form>{error && <Message>{error}</Message>}{loading ? <p>Đang tải…</p> : data && <>{data.items.length ? <div className="product-grid">{data.items.map(item => <ProductCard key={item.id} product={item} />)}</div> : <div className="panel empty"><h3>Chưa có sản phẩm phù hợp</h3><p>Thử từ khóa khác nhé.</p></div>}<div className="pagination"><span>{data.total} sản phẩm</span><div className="button-row"><button className="button secondary small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 12))}>Trước</button><button className="button secondary small" disabled={offset + 12 >= data.total} onClick={() => setOffset(offset + 12)}>Sau</button></div></div></>}</section>;
}

export function Detail() {
  const { id } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (!id || !/^\d+$/.test(id) || Number(id) < 1) { setError('Sản phẩm không tồn tại.'); return; } let active = true; api.product(Number(id)).then(value => { if (active) setProduct(value); }).catch(err => { if (active) setError(errorMessage(err)); }); return () => { active = false; }; }, [id]);
  return <section className="container page"><Link className="back-link" to="/products">← Trở lại danh mục</Link>{error && <Message>{error}</Message>}{product && <div className="detail-grid"><ProductImage name={product.name} src={product.image_url} /><div><span className="eyebrow">{product.category}</span><h1>{product.name}</h1><strong className="big-price">{formatPrice(product.price)}</strong><p className="description">{product.description}</p><p>Còn {product.quantity} sản phẩm</p><div className="button-row"><label>Số lượng<input aria-label="Số lượng" type="number" min="1" max={Math.min(product.quantity, 99)} value={quantity} onChange={event => setQuantity(Number(event.target.value))} disabled={product.quantity === 0} /></label><button className="button primary" disabled={product.quantity < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, product.quantity)} onClick={() => { try { add(product, quantity); setNotice('Đã thêm vào giỏ hàng.'); } catch (err) { setNotice(errorMessage(err)); } }}>Thêm vào giỏ</button><Link className="button secondary" to="/cart">Xem giỏ</Link></div>{notice && <div className="message success" role="status">{notice}</div>}</div></div>}</section>;
}

type Resolved = { product: Product } | { error: string };
function useResolvedCart() {
  const { lines } = useCart();
  const [products, setProducts] = useState<Record<number, Resolved>>({});
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const ids = lines.map(line => line.productId).join(',');
  useEffect(() => { let active = true; if (!ids) { setProducts({}); setLoading(false); return; } setLoading(true);
    void Promise.all(ids.split(',').map(async value => { const id = Number(value); try { return [id, { product: await api.product(id) }] as const; } catch (err) { return [id, { error: errorMessage(err) }] as const; } }))
      .then(entries => { if (active) setProducts(Object.fromEntries(entries)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ids, revision]);
  const valid = lines.length > 0 && !loading && lines.every(line => {
    const result = products[line.productId];
    return result && 'product' in result && line.quantity <= result.product.quantity;
  });
  const total = lines.reduce((sum, line) => {
    const result = products[line.productId];
    if (!result || !('product' in result) || line.quantity > result.product.quantity) return sum;
    const [whole, fraction = ''] = result.product.price.split('.');
    if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return sum;
    return sum + (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(line.quantity);
  }, 0n);
  const totalLabel = formatPrice(Number(total / 100n));
  return { lines, products, loading, valid, totalLabel, refresh: () => setRevision(value => value + 1) };
}

export function Cart() {
  const { update, remove } = useCart();
  const { user } = useAuth();
  const { lines, products, loading, valid, totalLabel, refresh } = useResolvedCart();
  const [error, setError] = useState('');
  return <section className="container page"><div className="section-title"><div><span className="eyebrow">GÓC MUA SẮM</span><h1>Giỏ hàng của bạn.</h1><p>Chỉnh số lượng trước khi đặt hàng.</p></div><Link to="/products">Tiếp tục mua sắm →</Link></div>{error && <Message>{error}</Message>}{lines.length ? <div className="cart-layout"><div className="cart-list">{loading ? <p>Đang kiểm tra sản phẩm…</p> : lines.map(line => { const result = products[line.productId]; return <article className="panel cart-row" key={line.productId}>{result && 'product' in result ? <><ProductImage name={result.product.name} src={result.product.image_url} /><div className="cart-item-info"><Link to={`/products/${line.productId}`}>{result.product.name}</Link><strong>{formatPrice(result.product.price)}</strong><span>{line.quantity > result.product.quantity ? `Chỉ còn ${result.product.quantity} sản phẩm.` : `Số lượng: ${line.quantity}`}</span></div><div className="quantity-controls"><button aria-label={`Giảm ${result.product.name}`} disabled={line.quantity <= 1} onClick={() => update(line.productId, line.quantity - 1)}>−</button><span>{line.quantity}</span><button aria-label={`Tăng ${result.product.name}`} disabled={line.quantity >= Math.min(99, result.product.quantity)} onClick={() => update(line.productId, line.quantity + 1)}>+</button></div></> : <p className="muted">Sản phẩm #{line.productId}: {result && 'error' in result ? result.error : 'Đang kiểm tra…'}</p>}<button className="text-button" onClick={() => { try { remove(line.productId); } catch (err) { setError(errorMessage(err)); } }}>Xóa</button></article>; })}</div><aside className="panel summary"><span className="eyebrow">GIỎ HÀNG</span><h2>Tạm tính</h2><div className="summary-total"><span>{lines.reduce((sum, line) => sum + line.quantity, 0)} sản phẩm</span><strong>{loading ? '…' : totalLabel}</strong></div><p>Giá chỉ là dự kiến. Backend kiểm tra lại giá và tồn kho khi tạo đơn.</p>{!valid && !loading && <Message>Một số sản phẩm đã hết hàng hoặc không còn hiển thị.</Message>}{valid ? <Link className="button primary full" to={user ? '/checkout' : '/login'}>{user ? 'Tiến hành đặt hàng' : 'Đăng nhập để đặt hàng'}</Link> : <button className="button primary full" disabled>Kiểm tra giỏ hàng</button>}<button className="button secondary full" onClick={refresh} disabled={loading}>Kiểm tra lại giá &amp; tồn kho</button></aside></div> : <div className="panel empty"><h2>Giỏ hàng đang trống</h2><p>Cùng chọn một món đồ bạn thích nhé.</p><Link className="button primary" to="/products">Xem sản phẩm</Link></div>}</section>;
}

export function Checkout() {
  const { lines, valid, totalLabel, loading, refresh } = useResolvedCart();
  const { clear } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  if (!lines.length && !created) return <Navigate to="/cart" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!valid || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const order = await api.checkout({ recipient_name: String(form.get('recipient_name')).trim(), phone: String(form.get('phone')).trim(),
        address: String(form.get('address')).trim(), note: String(form.get('note')).trim() || null,
        items: lines.map(line => ({ product_id: line.productId, quantity: line.quantity })) });
      setCreated(true); clear(); navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) { setError(errorMessage(err)); refresh(); }
    finally { setBusy(false); }
  }
  return <section className="container page"><span className="eyebrow">HOÀN TẤT ĐƠN HÀNG</span><h1>Thông tin nhận hàng.</h1><p>Đơn được lưu ở trạng thái chờ thanh toán; anh/chị có thể thanh toán mô phỏng sau khi tạo.</p>{error && <Message>{error}</Message>}<div className="checkout-layout"><form className="panel" onSubmit={submit}><h2>Địa chỉ giao hàng</h2><fieldset disabled={busy}><label>Họ và tên người nhận<input name="recipient_name" required minLength={2} maxLength={100} /></label><label>Số điện thoại<input name="phone" inputMode="tel" required pattern="\+?[0-9]{9,15}" placeholder="0912345678" /></label><label>Địa chỉ<input name="address" required minLength={10} maxLength={300} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" /></label><label>Ghi chú (tùy chọn)<textarea name="note" maxLength={500} rows={3} /></label><button className="button primary full" type="submit" disabled={!valid || loading || busy}>{busy ? 'Đang tạo đơn…' : 'Xác nhận đặt hàng'}</button></fieldset></form><aside className="panel summary"><h2>Đơn của bạn</h2><p>{lines.reduce((sum, line) => sum + line.quantity, 0)} sản phẩm</p><strong className="big-price">{totalLabel}</strong><p>Tổng tiền chỉ tham khảo; máy chủ sẽ tính lại từ giá sản phẩm hiện tại.</p>{!valid && !loading && <Message>Giỏ hàng không còn hợp lệ. Vui lòng kiểm tra lại.</Message>}<Link to="/cart">← Quay lại giỏ</Link></aside></div></section>;
}

const orderLabels: Record<Order['status'], string> = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', shipping: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; api.orders().then(value => { if (active) setOrders(value); }).catch(err => { if (active) setError(errorMessage(err)); }); return () => { active = false; }; }, []);
  return <section className="container page"><span className="eyebrow">ĐƠN MUA CỦA TÔI</span><h1>Lịch sử đơn hàng.</h1>{error && <Message>{error}</Message>}{orders.length ? <div className="order-list">{orders.map(order => <Link className="panel order-card" to={`/orders/${order.id}`} key={order.id}><strong>Đơn #{order.id}</strong><span>{orderLabels[order.status]} · {order.payment_status === 'paid' ? 'Đã thanh toán mô phỏng' : 'Chưa thanh toán'}</span><strong>{formatPrice(order.total)}</strong></Link>)}</div> : <div className="panel empty"><h2>Chưa có đơn hàng</h2><Link to="/products">Khám phá sản phẩm →</Link></div>}</section>;
}

export function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id || !/^\d+$/.test(id) || Number(id) < 1) { setError('Đơn hàng không tồn tại.'); return; } let active = true; api.order(Number(id)).then(value => { if (active) setOrder(value); }).catch(err => { if (active) setError(errorMessage(err)); }); return () => { active = false; }; }, [id]);
  async function action(kind: 'pay' | 'cancel') { if (!order || busy) return; setBusy(true); setError(''); try { const result = kind === 'pay' ? await api.pay(order.id) : await api.cancel(order.id); setOrder(result); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }
  return <section className="container page"><Link className="back-link" to="/orders">← Các đơn của tôi</Link>{error && <Message>{error}</Message>}{order && <><div className="section-title"><div><span className="eyebrow">ĐƠN HÀNG #{order.id}</span><h1>Chi tiết đơn hàng.</h1><p>{orderLabels[order.status]} · {order.payment_status === 'paid' ? 'Đã thanh toán mô phỏng' : 'Chưa thanh toán'}</p></div></div><div className="checkout-layout"><div className="panel"><h2>Sản phẩm đã đặt</h2>{order.items.map(item => <div className="order-row" key={item.product_id}><strong>{item.product_name}</strong><span>{item.quantity} × {formatPrice(item.unit_price)}</span></div>)}<div className="summary-total"><span>Tổng tiền</span><strong>{formatPrice(order.total)}</strong></div></div><aside className="panel summary"><h2>Thông tin nhận hàng</h2><p><strong>{order.recipient_name}</strong><br />{order.phone}<br />{order.address}</p>{order.note && <p>Ghi chú: {order.note}</p>}{order.status === 'pending' && order.payment_status === 'pending' && <><button className="button primary full" disabled={busy} onClick={() => void action('pay')}>Thanh toán mô phỏng</button><button className="button secondary full" disabled={busy} onClick={() => void action('cancel')}>Hủy đơn chưa thanh toán</button></>}<p className="fine-print">Thanh toán mô phỏng chỉ đổi trạng thái trong hệ thống; không thu tiền thật.</p></aside></div></>}</section>;
}

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, login, error: authError } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); const password = String(values.get('password'));
    if (new TextEncoder().encode(password).length > 72) { setError('Mật khẩu vượt giới hạn 72 byte UTF-8.'); return; }
    if (register && values.get('confirm') !== password) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    setBusy(true); setError('');
    try { if (register) { await api.register(String(values.get('username')).trim(), String(values.get('email')).trim(), password); setDone(true); }
      else { await login(String(values.get('email')).trim(), password); navigate('/', { replace: true }); }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <section className="container auth-layout"><div className="auth-aside"><span className="eyebrow">CHÀO MỪNG ĐẾN MYSHOP</span><h1>{register ? 'Bắt đầu hành trình mua sắm của bạn.' : 'Thật vui khi bạn quay lại.'}</h1><p>Một tài khoản để tìm món đồ hay, đặt hàng và theo dõi những đơn mua của bạn.</p><div className="auth-decor">✦</div></div><div className="auth-main">{done ? <><h2>Đăng ký thành công!</h2><p>Tài khoản đã sẵn sàng. Hãy đăng nhập để bắt đầu mua sắm.</p><Link className="button primary" to="/login">Đến trang đăng nhập</Link></> : <><span className="eyebrow">{register ? 'THAM GIA MYSHOP' : 'CHÀO MỪNG TRỞ LẠI'}</span><h2>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</h2><p>{register ? 'Tài khoản mới được tạo với quyền khách hàng.' : 'Tiếp tục mua sắm tại MyShop.'}</p>{(error || authError) && <Message>{error || authError}</Message>}<form onSubmit={submit}><fieldset disabled={busy}>{register && <label>Tên người dùng<input name="username" required minLength={3} maxLength={50} autoComplete="username" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Mật khẩu<input name="password" type="password" required minLength={register ? 8 : 1} maxLength={72} autoComplete={register ? 'new-password' : 'current-password'} /></label>{register && <label>Xác nhận mật khẩu<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>}<button className="button primary full">{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}</button></fieldset></form><p className="auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <Link to={register ? '/login' : '/register'}>{register ? 'Đăng nhập' : 'Đăng ký ngay'}</Link></p></>}</div></section>;
}
