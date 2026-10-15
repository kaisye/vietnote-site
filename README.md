# vietnote-site

Trang giới thiệu và tải VietNote. HTML tĩnh trong `public/`, chạy bằng Cloudflare Workers (static assets).

| File | Nội dung |
|---|---|
| `public/index.html` | Trang chủ: giới thiệu, tính năng, bảng giá, hỏi đáp, nút tải |
| `public/thanh-toan.html` | Trang payOS chuyển về sau khi thanh toán (`/thanh-toan`) |
| `public/app.js` | Tải bảng giá từ Supabase, ưu tiên nút tải theo hệ điều hành |
| `public/config.js` | Địa chỉ Supabase và anon key (công khai theo thiết kế) |
| `public/feedback.html` | Form khảo sát dành cho 100 người dùng đầu tiên (`/feedback`) |
| `public/email-100-users.html` | Email HTML chúc mừng và mời góp ý; thay `{{name}}`, `{{feedback_url}}` trước khi gửi |
| `src/worker.js`, `src/download.js` | `/download/mac`, `/download/windows`: tải bản mới nhất qua domain của trang, không lộ link GitHub; video `.mp4` được trả theo từng đoạn (Range) để tua được; `/youtube-player` phục vụ player YouTube có thể nhúng trong app |

## Form góp ý

Form tự lưu nháp trong trình duyệt và gửi JSON tới `/api/feedback`. Cloudflare Worker kiểm tra dữ liệu rồi ghi vào bảng Supabase `feedback_responses` bằng secret `SUPABASE_SECRET_KEY`.

Đặt secret trên Cloudflare:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
```

Để chạy Worker local, tạo `.dev.vars` (file này đã được gitignore):

```text
SUPABASE_SECRET_KEY=sb_secret_...
```

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

## Đổi số phút tặng khi đăng ký

Vào Supabase → **Table Editor → app_settings**, sửa `value` của dòng `signup_bonus_minutes`
(vd. `120`) rồi lưu. Tài khoản đăng ký sau đó nhận số phút mới; trang web hiển thị ngay.
Tài khoản đã có không thay đổi.

## Deploy lên Cloudflare

Repo đã được kết nối với Worker `web` (Workers & Pages → Import a repository);
mỗi lần push lên `main` Cloudflare tự chạy `npx wrangler deploy` với `wrangler.jsonc`.

Deploy tay: `npx wrangler deploy`. Xem thử trên máy (có cả `/download/*`): `npx wrangler dev`.

Khi đổi domain, đặt secret `SITE_URL` của Supabase thành domain mới
(để payOS chuyển về đúng trang `/thanh-toan`).
