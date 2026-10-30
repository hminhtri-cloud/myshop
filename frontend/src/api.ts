export interface User { id: number; username: string; email: string; role: 'customer' | 'admin'; created_at: string }
export interface Product { id: number; name: string; description: string; category: string; price: string; quantity: number; image_url: string | null; active: boolean; created_at: string }
export type ProductInput = Omit<Product, 'id' | 'created_at'>;
export interface Page<T> { items: T[]; total: number; offset: number; limit: number }
export interface OrderItem { product_id: number; product_name: string; unit_price: string; quantity: number }
export interface Order { id: number; customer_id: number; recipient_name: string; phone: string; address: string; note: string | null; total: string; payment_status: 'pending' | 'paid'; status: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled'; created_at: string; items: OrderItem[] }
export interface Checkout { recipient_name: string; phone: string; address: string; note: string | null; items: { product_id: number; quantity: number }[] }

const TOKEN_KEY = 'myshop.access-token';
export const session = { get: () => sessionStorage.getItem(TOKEN_KEY), set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token), clear: () => sessionStorage.removeItem(TOKEN_KEY) };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const messages: Record<string, string> = {
  'Invalid email or password': 'Email hoặc mật khẩu chưa đúng.',
  'Invalid or expired access token': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  'Email or username already registered': 'Email hoặc tên đăng nhập đã được sử dụng.',
  'Admin permission required': 'Trang này chỉ dành cho quản trị viên.',
  'Product not found': 'Sản phẩm không còn hiển thị.',
  'Product unavailable or insufficient stock': 'Sản phẩm đã hết hàng, bị ẩn hoặc không đủ số lượng. Hãy kiểm tra lại giỏ hàng.',
  'Order not found': 'Không tìm thấy đơn hàng của bạn.',
  'Only unpaid pending orders can be cancelled': 'Đơn đã thanh toán hoặc đang xử lý không thể hủy ở đây.',
  'Cancelled order cannot be paid': 'Không thể thanh toán đơn đã hủy.',
  'Invalid order transition or payment pending': 'Đơn chưa thanh toán hoặc không thể chuyển sang trạng thái này.',
};

export async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  const token = authenticated ? session.get() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`/api${path}`, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(15000) }); }
  catch (err) {
    if (options.signal?.aborted) throw err;
    throw new ApiError(0, 'Không kết nối được API. Hãy kiểm tra Docker và thử lại.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) { session.clear(); window.dispatchEvent(new Event('myshop:unauthorized')); }
    const detail: unknown = data?.detail;
    const message = typeof detail === 'string' ? (messages[detail] || detail) :
      Array.isArray(detail) ? detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.slice(1).join('.') || 'Dữ liệu'}: ${item.msg}`).join(' · ') : 'Máy chủ gặp lỗi.';
    throw new ApiError(response.status, message);
  }
  return data as T;
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Đã xảy ra lỗi.';
export const formatPrice = (price: string | number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(price));
export const api = {
  register: (username: string, email: string, password: string) => request<User>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }, false),
  login: (email: string, password: string) => request<{ access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
  me: () => request<User>('/auth/me'),
  products: (search = '', offset = 0) => request<Page<Product>>(`/products?${new URLSearchParams({ search, offset: String(offset), limit: '12' })}`, {}, false),
  product: (id: number) => request<Product>(`/products/${id}`, {}, false),
  adminProducts: () => request<Page<Product>>('/admin/products?limit=100'),
  createProduct: (data: ProductInput) => request<Product>('/admin/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: ProductInput) => request<Product>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  checkout: (data: Checkout) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  orders: () => request<Order[]>('/orders'),
  order: (id: number) => request<Order>(`/orders/${id}`),
  pay: (id: number) => request<Order>(`/orders/${id}/pay`, { method: 'POST' }),
  cancel: (id: number) => request<Order>(`/orders/${id}/cancel`, { method: 'POST' }),
  adminOrders: () => request<Order[]>('/admin/orders'),
  advance: (id: number, status: 'confirmed' | 'shipping' | 'completed') => request<Order>(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
