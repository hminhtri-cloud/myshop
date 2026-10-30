# MyShop — một chủ shop, nhiều khách hàng

Đây là **project riêng** với MicroShop. Một tài khoản **admin (chủ shop)** đăng
và quản lý sản phẩm, xem và xử lý đơn; người khác đăng ký tài khoản **customer**
để xem hàng, thêm giỏ, đặt hàng và thanh toán **mô phỏng**. Không có role seller,
không có xét duyệt người bán, không có thanh toán thật.

Stack giống project học tập trước: **React + Vite + TypeScript**, **FastAPI +
SQLAlchemy**, **MySQL**, **Docker Compose**. Backend hiện là **modular monolith**
(auth/products/orders thành các module trong một API container) vì một chủ shop
không cần chi phí vận hành nhiều microservice. Các module có thể tách về sau.

## Chạy local

Yêu cầu: Docker Desktop, Docker Compose v2, Node.js và npm. Cổng của MyShop
được chọn khác MicroShop để có thể chạy đồng thời:

| Thành phần | URL local | Chạy ở đâu |
|---|---|---|
| Website | http://127.0.0.1:5174/ | Vite trên Mac |
| API/Swagger | http://127.0.0.1:8003/docs | Docker |
| MySQL | `127.0.0.1:3308` | Docker; backend dùng `mysql:3306` |

Từ thư mục **`myshop`**:

1. Nếu chưa có `.env`, copy `.env.example` thành `.env`, tự điền mật khẩu MySQL
   và tạo `JWT_SECRET` bằng `openssl rand -hex 32`. `.env` được Git bỏ qua.
2. Mở Docker Desktop và chạy:

```bash
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
```

3. Tạo **tài khoản admin đầu tiên** bằng lệnh tương tác. Anh tự đặt username,
   email và password; password không hiển thị khi nhập:

```bash
docker compose exec api python -m app.create_admin
```

4. Mở terminal thứ hai trong thư mục **`myshop/frontend`**:

```bash
npm ci
npm run dev
```

5. Mở http://127.0.0.1:5174. Đăng nhập tài khoản admin để **Quản trị → Sản
   phẩm → Đăng sản phẩm**. Chưa có sản phẩm mặc định; để người mua thấy sản phẩm,
   chủ shop cần đăng ít nhất một sản phẩm. URL ảnh là tùy chọn; khi để trống
   giao diện dùng hình minh họa.

## Luồng thao tác để tự demo

```text
Admin đăng nhập → /admin/products → đăng sản phẩm, đặt tồn kho
        ↓
Customer đăng ký → /products → chọn món → /cart → /checkout
        ↓
Backend xác nhận giá & tồn kho → tạo đơn, giữ tồn kho
        ↓
Customer /orders/:id → Thanh toán mô phỏng → trạng thái paid
        ↓
Admin /admin/orders → xác nhận → đang giao → hoàn thành
```

Nếu đơn vẫn chưa thanh toán, customer có thể hủy để hoàn lại tồn kho. Đơn đã
thanh toán không thể hủy bằng nút này. Giỏ hàng trên browser giữ mã sản phẩm và
số lượng, **không giữ giá**; API tự tính lại tổng tiền, khóa hàng tồn kho lúc
checkout. Thao tác thanh toán mô phỏng **chỉ đổi trạng thái DB**, không thu tiền
hoặc kết nối ngân hàng.

## Các khu vực frontend

- `/`, `/products`, `/products/:id`: ai cũng xem được sản phẩm đang hiển thị.
- `/cart`: giỏ khách chưa đăng nhập hoặc giỏ riêng theo ID tài khoản; lưu bằng
  `localStorage` trên máy này, không đồng bộ thiết bị, giỏ guest không tự gộp
  sau khi đăng nhập.
- `/register`, `/login`: đăng ký luôn tạo **customer**; không thể tự cấp admin.
- `/checkout`, `/orders`, `/orders/:id`: cần đăng nhập; chỉ thấy đơn của mình.
- `/admin`, `/admin/products`, `/admin/orders`: chỉ admin. UI ẩn route không
  phải lớp bảo vệ duy nhất: API kiểm tra JWT và role trên mỗi request.

## Các file quan trọng

```text
myshop/
├── docker-compose.yml                 MySQL + backend API + volume riêng
├── .env.example                       mẫu config; .env thật không commit
├── backend/
│   ├── Dockerfile, requirements.txt
│   ├── app/
│   │   ├── main.py                    app, health/readiness, bootstrap local
│   │   ├── database.py, models.py     kết nối + 4 bảng
│   │   ├── schemas.py                 dữ liệu API và validation
│   │   ├── security.py, auth.py       JWT, role, register/login
│   │   ├── products.py                catalog và admin quản lý sản phẩm
│   │   ├── orders.py                  checkout, payment, hủy, xử lý đơn
│   │   └── create_admin.py            tạo admin tương tác
│   └── tests/test_flow.py             test HTTP với SQLite riêng
└── frontend/
    ├── vite.config.ts                 proxy /api → localhost:8003
    ├── src/
    │   ├── api.ts                     kiểu dữ liệu và HTTP client
    │   ├── state.tsx                  auth và giỏ hàng
    │   ├── Shop.tsx                   trang mua, giỏ, checkout, đơn
    │   ├── Admin.tsx                  quản lý sản phẩm, đơn
    │   ├── App.tsx, main.tsx          routing và bootstrap React
    │   └── styles.css                 tông trắng + #2f6bff
    └── tests/shop.spec.ts             test trình duyệt
```

## Test và build

Chạy test API trong container riêng bằng **SQLite in-memory**, không thay đổi
MySQL local của anh:

```bash
docker compose run --rm --no-deps \
  -e DATABASE_URL=sqlite:// \
  -v "$PWD/backend/tests:/tests:ro" \
  api python -m unittest discover -s /tests -v
```

Trong `myshop/frontend`:

```bash
npm ci
npm run build
npx playwright install chromium  # chỉ cần lần đầu
npm run test:e2e
npm audit --audit-level=high
```

Test browser giả lập thao tác ghi để không tạo user/order rác; một test chỉ
đọc endpoint `/api/health` và `/api/products` thật, vì thế cần chạy Docker
trước khi chạy đủ bộ test.

## Dữ liệu, giới hạn và hướng phát triển

- MySQL volume **`myshop_mysql_data`** tách khỏi MicroShop. `docker compose
  down` giữ dữ liệu; **không dùng `down -v`** nếu muốn giữ tài khoản và đơn.
- `Base.metadata.create_all()` chỉ để bootstrap schema **lần đầu**. Khi đổi
  bảng đã có phải dùng migration (ví dụ Alembic); `create_all()` không cập nhật
  cột hiện hữu. Chưa có backup hay recovery tự động.
- Checkout dùng MySQL row lock để không bán vượt tồn kho khi hai request cùng
  đến; test SQLite xác minh nghiệp vụ nhưng chưa phải kiểm thử tải đồng thời
  trên MySQL. Tồn kho được giữ ngay khi tạo đơn, nên đơn pending lâu không thanh
  toán cũng giữ hàng cho đến khi customer hủy; cần thêm timeout tự động sau.
- Admin product/order list hiện lấy tối đa 100/20 mục; cần pagination UI khi
  dữ liệu lớn. Ảnh lấy từ URL do admin cung cấp, chưa có upload file.
- JWT hiện lưu trong `sessionStorage` (đóng tab sẽ mất), không có refresh hoặc
  revoke token phía server. Khi deploy public cần HTTPS, thiết kế bảo vệ token,
  migration, CI/CD, giám sát và chính sách quản lý secrets phù hợp.
- Frontend chạy trên Mac bằng Vite; Docker Compose hiện đóng gói **backend và
  MySQL**. Khi web ổn định có thể build frontend thành image và đặt sau Nginx.
# myshop
