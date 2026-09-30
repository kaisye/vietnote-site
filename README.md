# vietnote-site

Trang giới thiệu và tải VietNote. HTML tĩnh, không cần build, host trên Cloudflare Pages.

| File | Nội dung |
|---|---|
| `index.html` | Trang chủ: giới thiệu, tính năng, bảng giá, hỏi đáp, nút tải |
| `thanh-toan.html` | Trang payOS chuyển về sau khi thanh toán (`/thanh-toan`) |
| `app.js` | Tải bảng giá từ Supabase, ưu tiên nút tải theo hệ điều hành |
| `config.js` | Địa chỉ Supabase và anon key (công khai theo thiết kế) |
| `functions/download/[platform].js` | `/download/mac`, `/download/windows`: tải bản mới nhất qua domain của trang, không lộ link GitHub |

## Đổi giá và khuyến mãi

Không cần sửa code. Vào Supabase → **Table Editor → credit_packages**, sửa ô rồi lưu. Trang web và app cập nhật ngay.

| Cột | Ý nghĩa |
|---|---|
| `name`, `hours`, `price_vnd` | Tên gói, số giờ, giá thường |
| `promo_price_vnd` | Giá khuyến mãi (giá thường hiện gạch ngang). Để trống = không giảm |
| `promo_bonus_hours` | Giờ tặng thêm |
| `promo_label` | Nhãn, vd. `Giảm 30% · Tết` |
| `promo_ends_at` | Khuyến mãi tự tắt sau thời điểm này. Để trống = không hạn |
| `highlight` | Tô nổi gói (nhãn “Phổ biến”) |
| `sort`, `active` | Thứ tự hiển thị, ẩn/hiện gói |

Không đổi `id` của gói đã có đơn hàng; muốn bỏ gói thì bỏ chọn `active`.

## Deploy lên Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**, chọn repo này.
2. Framework preset: **None**, Build command: để trống, Build output directory: `/`.
3. Mỗi lần push lên `main` Cloudflare tự deploy lại.
4. Gắn domain riêng ở **Custom domains**, rồi đặt secret `SITE_URL` của Supabase thành domain đó
   (để payOS chuyển về đúng trang `/thanh-toan`).

Xem thử trên máy: `python3 -m http.server 8787` rồi mở http://localhost:8787.
