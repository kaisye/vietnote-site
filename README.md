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
| `public/blog/`, `blog/`, `scripts/blog.mjs` | Blog (`/blog/`): tính năng mới và bài học. Viết bài trong `blog/`, trang trong `public/blog/` do script tạo |
| `src/worker.js`, `src/download.js` | `/download/mac`, `/download/windows`, `/download/linux` (.deb), `/download/appimage`: tải bản mới nhất qua domain của trang, không lộ link GitHub; video `.mp4` được trả theo từng đoạn (Range) để tua được; `/youtube-player` phục vụ player YouTube có thể nhúng trong app |

## Viết bài blog

Mỗi bài là một file `blog/<slug>.html` (slug thành đường dẫn `/blog/<slug>`): phần đầu khai báo thông tin bài, sau đó là nội dung HTML.

```html
---
title: Tiêu đề bài
description: Một hai câu tóm tắt, hiện dưới tiêu đề, trong danh sách và khi chia sẻ link
date: 2026-11-01
tag: Bài học
version: 0.8.44
---
<h2>Chuyện gì đã xảy ra</h2>
<p>…</p>
<aside class="takeaway"><strong>Điều rút ra</strong><p>…</p></aside>
```

`tag` là `Tính năng mới` hoặc `Bài học`. `version` (không bắt buộc, vd. `0.8.7`) hiện số phiên bản cạnh bài trên dòng thời gian của `/blog/`. Viết xong chạy `node scripts/blog.mjs` để tạo trang bài, danh sách `/blog/`, RSS `/blog/feed.xml` và cập nhật `sitemap.xml`, rồi commit cả hai thư mục. `node scripts/blog.mjs --check` báo lỗi nếu quên chạy.

Ảnh bìa là đoạn HTML đặt giữa `<!-- cover -->` và `<!-- /cover -->` ở đầu nội dung (xem các bài có sẵn, class `cover` và `cv-*` trong `public/blog.css`); nó dùng làm thumbnail, ảnh đầu bài, và `node scripts/blog.mjs --png` (cần Chrome) xuất ra `public/blog/<slug>.png` để hiện khi chia sẻ link. Hình minh hoạ trong bài là `<figure class="fig">` với các class `fig-*` trong `public/blog.css`.

Không nêu tên nhà cung cấp dịch vụ (nhận dạng giọng nói, AI…) trong bài.

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

## Trang quản trị (`/admin`)

Số liệu người dùng, doanh thu, chi phí, tỷ lệ quay lại và đơn hàng, lấy từ hàm Supabase `admin_dashboard()` (chỉ secret key gọi được). Đăng nhập bằng một tài khoản và mật khẩu đặt làm secret của Worker; đổi mật khẩu thì mọi phiên đăng nhập cũ hết hiệu lực.

```bash
npx wrangler secret put ADMIN_USER
npx wrangler secret put ADMIN_PASSWORD
```
