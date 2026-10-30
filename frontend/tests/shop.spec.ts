import { test, expect, type Page } from '@playwright/test';

const stamp = '2026-10-30T12:00:00';
const product = { id: 5, name: 'USB-C Adapter', description: 'Bộ chuyển đổi dành cho laptop', category: 'Phụ kiện',
  price: '125000.00', quantity: 3, image_url: null, active: true, created_at: stamp };
const order = { id: 8, customer_id: 1, recipient_name: 'Nguyễn Minh Tri', phone: '0912345678', address: '123 Đường ABC, TPHCM', note: null,
  total: '250000.00', payment_status: 'pending', status: 'pending', created_at: stamp,
  items: [{ product_id: 5, product_name: product.name, unit_price: product.price, quantity: 2 }] };

async function signedIn(page: Page, role: 'customer' | 'admin' = 'customer') {
  await page.addInitScript(() => sessionStorage.setItem('myshop.access-token', 'test-token'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    id: role === 'customer' ? 1 : 2, username: role, email: `${role}@example.com`, role, created_at: stamp,
  } }));
}

test('buyer storefront has its own look and works on mobile', async ({ page }) => {
  await page.route('**/api/products?*', route => route.fulfill({ json: { items: [product], total: 1, offset: 0, limit: 12 } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Những món đồ hay/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('customer cart persists but cannot order without authentication', async ({ page }) => {
  await page.route('**/api/products/5', route => route.fulfill({ json: product }));
  await page.goto('/products/5');
  await page.getByLabel('Số lượng').fill('2');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await page.goto('/cart');
  await expect(page.getByText('250.000 ₫')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập để đặt hàng' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('2 sản phẩm trong giỏ')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('myshop.cart.v1.guest')!))).toEqual([{ productId: 5, quantity: 2 }]);
});

test('authenticated buyer creates an order without sending price, then mock pays', async ({ page }) => {
  await signedIn(page);
  await page.route('**/api/products/5', route => route.fulfill({ json: product }));
  let payload: unknown;
  await page.route('**/api/orders', route => { payload = route.request().postDataJSON(); return route.fulfill({ status: 201, json: order }); });
  await page.route('**/api/orders/8', route => route.fulfill({ json: order }));
  await page.route('**/api/orders/8/pay', route => route.fulfill({ json: { ...order, payment_status: 'paid' } }));
  await page.goto('/products/5');
  await page.getByLabel('Số lượng').fill('2');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Tiến hành đặt hàng' }).click();
  await page.getByLabel('Họ và tên người nhận').fill('Nguyễn Minh Tri');
  await page.getByLabel('Số điện thoại').fill('0912345678');
  await page.getByLabel('Địa chỉ').fill('123 Đường ABC, TPHCM');
  await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).click();
  await expect(page).toHaveURL(/\/orders\/8$/);
  expect(payload).toEqual({ recipient_name: 'Nguyễn Minh Tri', phone: '0912345678', address: '123 Đường ABC, TPHCM', note: null, items: [{ product_id: 5, quantity: 2 }] });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('myshop.cart.v1.user-1')!))).toEqual([]);
  await page.getByRole('button', { name: 'Thanh toán mô phỏng' }).click();
  await expect(page.getByText('Đã thanh toán mô phỏng')).toBeVisible();
});

test('checkout conflict preserves cart and shows stock error', async ({ page }) => {
  await signedIn(page);
  await page.route('**/api/products/5', route => route.fulfill({ json: product }));
  await page.route('**/api/orders', route => route.fulfill({ status: 409, json: { detail: 'Product unavailable or insufficient stock' } }));
  await page.goto('/products/5');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await page.goto('/checkout');
  await page.getByLabel('Họ và tên người nhận').fill('Nguyễn Minh Tri');
  await page.getByLabel('Số điện thoại').fill('0912345678');
  await page.getByLabel('Địa chỉ').fill('123 Đường ABC, TPHCM');
  await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).click();
  await expect(page.getByRole('alert')).toContainText('không đủ số lượng');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('myshop.cart.v1.user-1')!))).toEqual([{ productId: 5, quantity: 1 }]);
});

test('customer cannot access admin area; admin can publish a product', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập.' })).toBeVisible();
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 2, username: 'owner', email: 'owner@example.com', role: 'admin', created_at: stamp } }));
  await page.route('**/api/admin/products?*', route => route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 100 } }));
  let created = false;
  await page.route('**/api/admin/products', route => { expect(route.request().postDataJSON()).toMatchObject({ name: 'USB-C Adapter', price: '125000.00' }); created = true; return route.fulfill({ status: 201, json: product }); });
  await page.reload();
  await page.goto('/admin/products');
  await expect(page.getByRole('navigation', { name: 'Menu quản trị' })).toBeVisible();
  await page.getByLabel('Tên sản phẩm').fill('USB-C Adapter');
  await page.getByLabel('Mô tả').fill('Bộ chuyển đổi dành cho laptop');
  await page.getByLabel('Danh mục').fill('Phụ kiện');
  await page.getByLabel('Giá (VND)').fill('125000.00');
  await page.getByLabel('Số lượng').fill('3');
  await page.getByRole('button', { name: 'Đăng sản phẩm' }).click();
  await expect(page.getByRole('status')).toContainText('Đã đăng sản phẩm.');
  expect(created).toBe(true);
});

test('Vite API proxy reaches isolated MyShop backend without writing data', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  const catalog = await request.get('/api/products');
  expect(catalog.ok()).toBeTruthy();
  expect(await catalog.json()).toHaveProperty('items');
});
