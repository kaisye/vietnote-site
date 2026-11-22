// vietnote.vn/n/<token>: a note someone shared from VietNote, for anyone with the link. Rendered
// here (not in the browser) so Zalo, Messenger and Slack show its title when the link is pasted.
// The note comes from get_share() with the public key; the token is all that grants access.
import { escapeHTML, markdownToHTML } from './markdown.js'

const TOKEN = /^[A-Za-z0-9_-]{22}$/
// Public by design (see public/config.js).
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5a25rc2Z5cWxzZnFvZGNzYXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzI4OTcsImV4cCI6MjEwNjMwODg5N30.kTs7eHTXO6YLt3D2BdM-utJoTv_NNSN4IW9piZUET0c'

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // Only the page's own inline style and script, the font, and nothing else.
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
}

export async function sharePage(token, env, fetcher = fetch) {
  if (!TOKEN.test(token)) return page(gone(), 404)
  let shared = null
  try {
    const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/get_share`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    })
    if (!response.ok) return page(unavailable(), 503)
    shared = await response.json()
  } catch {
    return page(unavailable(), 503)
  }
  if (!shared?.note) return page(gone(), 404)
  return page(noteBody(shared, token), 200, shared.note)
}

function page({ title, description, body }, status, note) {
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#fbfbfc">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(description)}">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:image" content="https://vietnote.vn/assets/og-v3.jpg">
<meta property="og:type" content="article">
<meta property="og:site_name" content="VietNote">
${note ? '<meta name="apple-itunes-app" content="app-id=6834786419">' : ''}
<link rel="icon" href="/assets/logo-v3.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body>
<header class="bar"><a class="brand" href="https://vietnote.vn/" target="_blank" rel="noopener">${LOGO}<span>VietNote</span></a></header>
<main>${body}</main>
<footer><p>Ghi chú được chia sẻ bằng <a href="https://vietnote.vn/" target="_blank" rel="noopener">VietNote</a>. Người chia sẻ có thể thu hồi link bất cứ lúc nào.</p>
${note ? '<p><a href="mailto:support@vietnote.vn?subject=B%C3%A1o%20c%C3%A1o%20link%20chia%20s%E1%BA%BB">Báo cáo nội dung không phù hợp</a></p>' : ''}</footer>
${note ? SCRIPT : ''}
</body>
</html>`
  return new Response(html, { status, headers: HEADERS })
}

const durationText = seconds => {
  const minutes = Math.round((Number(seconds) || 0) / 60)
  if (minutes < 1) return ''
  return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60 ? `${minutes % 60} phút` : ''}`.trim()
}

const dateText = iso => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const clock = seconds => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
}

const plain = markdown => String(markdown ?? '').replace(/\s*\[[^\]\n]*\]\(#t=[^)\s]*\)/g, '').replace(/[#*_`>|-]+/g, ' ').replace(/\s+/g, ' ').trim()

const DOCUMENT_NAMES = { meeting: 'Biên bản họp', lecture: 'Ghi chép bài giảng', workshop: 'Ghi chép hội thảo', article: 'Bài viết', post: 'Bài đăng', custom: 'Tài liệu' }

function noteBody(shared, token) {
  const note = shared.note
  const title = String(note.title || 'Ghi chú cuộc họp').slice(0, 300)
  const meta = [dateText(note.createdAt), durationText(note.duration)].filter(Boolean).join(' · ')
  const summary = String(note.summary || '').trim()
  const description = plain(summary).slice(0, 180) || 'Ghi chú cuộc họp được chia sẻ từ VietNote.'
  const sections = []

  sections.push(`<section class="card summary" aria-label="Tóm tắt"><div class="md">${summary ? markdownToHTML(summary) : '<p class="muted">Ghi chú này chưa có tóm tắt.</p>'}</div></section>`)

  for (const document of Array.isArray(note.documents) ? note.documents : []) {
    sections.push(`<details class="card"><summary><h2 class="label">${escapeHTML(DOCUMENT_NAMES[document.kind] ?? 'Tài liệu')}</h2></summary><div class="md">${markdownToHTML(document.markdown)}</div></details>`)
  }

  const lines = Array.isArray(note.lines) ? note.lines : []
  if (lines.length || note.transcriptText) {
    const body = lines.length
      ? lines.map(line => `<p class="line"><span class="time">${clock(line.start)}</span>${line.speaker ? `<b>${escapeHTML(line.speaker)}:</b> ` : ''}${escapeHTML(line.text)}${
          line.translation ? `<span class="tr">${escapeHTML(line.translation)}</span>` : ''}</p>`).join('')
      : `<p class="plain">${escapeHTML(note.transcriptText).replace(/\n/g, '<br>')}</p>`
    sections.push(`<details class="card"><summary><h2 class="label">Lời chép${lines.length ? ` · ${lines.length} câu` : ''}</h2></summary><div class="transcript">${body}</div></details>`)
  }

  const chat = Array.isArray(note.chat) ? note.chat : []
  if (chat.length) {
    sections.push(`<details class="card"><summary><h2 class="label">Hỏi đáp · ${chat.length} tin</h2></summary><div class="chat">${chat.map(message =>
      message.role === 'user'
        ? `<p class="ask">${escapeHTML(message.text)}</p>`
        : `<div class="answer md">${markdownToHTML(message.text)}</div>`).join('')}</div></details>`)
  }

  const body = `<article>
<h1>${escapeHTML(title)}</h1>
${meta ? `<p class="meta">${escapeHTML(meta)}</p>` : ''}
${sections.join('\n')}
</article>
<aside class="save card">
<p><b>Lưu vào VietNote của bạn</b> để đọc lại, hỏi AI về cuộc họp này và mở trên mọi máy.</p>
<div class="actions">
<a class="button primary" id="open-app" href="vietnote://n/${token}">Lưu vào VietNote của tôi</a>
<a class="button" id="get-app" href="https://vietnote.vn/#tai-ve" target="_blank" rel="noopener">Tải VietNote</a>
</div>
<p class="hint" id="hint">Chưa có VietNote? Tải miễn phí cho iPhone, Android, Mac và Windows.</p>
</aside>`
  return { title: `${title} · VietNote`, description, body }
}

function gone() {
  return {
    title: 'Link không còn dùng được · VietNote',
    description: 'Link chia sẻ này đã hết hạn hoặc đã bị thu hồi.',
    body: `<article class="empty"><h1>Link này không còn dùng được</h1><p>Link chia sẻ đã hết hạn hoặc người chia sẻ đã thu hồi. Hãy nhờ họ gửi lại link mới.</p><p><a class="button primary" href="https://vietnote.vn/">Tìm hiểu VietNote</a></p></article>`,
  }
}

function unavailable() {
  return {
    title: 'Chưa mở được ghi chú · VietNote',
    description: 'Máy chủ VietNote đang bận. Thử lại sau ít phút.',
    body: `<article class="empty"><h1>Chưa mở được ghi chú</h1><p>Máy chủ VietNote đang bận. Tải lại trang sau ít phút.</p></article>`,
  }
}

// Points "Tải VietNote" at this device's store, and tells desktop visitors the app opens the link.
const SCRIPT = `<script>
(function () {
  var ua = navigator.userAgent, get = document.getElementById('get-app'), hint = document.getElementById('hint');
  if (/iPhone|iPad|iPod/.test(ua)) { get.href = '/ios'; }
  else if (/Android/.test(ua)) { get.href = '/download/android'; }
  else if (/Mac/.test(ua)) { get.href = '/download/mac'; }
  else if (/Windows/.test(ua)) { get.href = '/download/windows'; }
  document.getElementById('open-app').addEventListener('click', function () {
    setTimeout(function () { if (!document.hidden) hint.textContent = 'Nếu VietNote chưa mở, hãy tải và cài VietNote rồi bấm lại.'; }, 1500);
  });
})();
</script>`

const LOGO = '<img src="/assets/logo-v3.svg" width="24" height="24" alt="">'

const STYLE = `
:root{--bg:#fbfbfc;--surface:#fff;--ink:#17151c;--muted:#5d5a66;--faint:#9a97a3;--border:#ebeaef;--brand:#d81e73;--brand-strong:#be1663;--mist:#f4f3f7;--shadow:0 1px 2px rgba(23,21,28,.04),0 4px 14px rgba(23,21,28,.035);color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Be Vietnam Pro",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif}
a{color:var(--brand)}
.bar{max-width:760px;margin:0 auto;padding:18px 16px 4px}
.brand{display:inline-flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none;font-weight:700}
main{max-width:760px;margin:0 auto;padding:8px 16px 24px}
h1{font-size:clamp(24px,5vw,32px);line-height:1.25;margin:18px 0 6px;letter-spacing:-.01em;overflow-wrap:anywhere}
.meta{color:var(--muted);margin:0 0 18px;font-size:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px 20px;margin:0 0 14px;box-shadow:var(--shadow)}
.label{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);margin:0}
.summary .label{margin-bottom:6px}
details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between}
details>summary::-webkit-details-marker{display:none}
details>summary::after{content:"";width:9px;height:9px;border-right:2px solid var(--faint);border-bottom:2px solid var(--faint);transform:rotate(45deg);margin:0 4px 4px 0;transition:transform .2s}
details[open]>summary::after{transform:rotate(-135deg);margin-bottom:-4px}
details[open]>summary{margin-bottom:10px}
.md{overflow-wrap:anywhere}
.md h2{font-size:18px;margin:18px 0 6px}.md h3,.md h4{font-size:16px;margin:16px 0 4px}
.md>:first-child{margin-top:4px}.md>:last-child{margin-bottom:0}
.md p{margin:6px 0}.md ul,.md ol{margin:6px 0;padding-left:22px}.md li{margin:3px 0}
.md li.task{list-style:none;margin-left:-22px;display:flex;gap:9px;align-items:flex-start}
.md li.task .box{flex:none;width:16px;height:16px;margin-top:4px;border:2px solid var(--faint);border-radius:5px}
.md li.task.done .box{background:var(--brand);border-color:var(--brand)}
.md li.task.done{color:var(--muted);text-decoration:line-through}
.md code{background:var(--mist);border-radius:6px;padding:1px 5px;font-size:.92em}
.md pre{background:var(--mist);border-radius:10px;padding:12px;overflow:auto}.md pre code{background:none;padding:0}
.md blockquote{margin:8px 0;padding:2px 12px;border-left:3px solid var(--border);color:var(--muted)}
.md hr{border:0;border-top:1px solid var(--border);margin:14px 0}
.table{overflow-x:auto}.md table{border-collapse:collapse;font-size:15px}.md th,.md td{border:1px solid var(--border);padding:6px 10px;text-align:left}
.transcript .line{margin:0 0 10px}.time{display:inline-block;min-width:52px;color:var(--faint);font-size:13px;font-variant-numeric:tabular-nums}
.tr{display:block;margin-left:52px;color:var(--muted);font-size:15px}
.plain{white-space:normal;margin:0}
.chat .ask{margin:12px 0 6px;font-weight:600}.chat .ask::before{content:"Hỏi · ";color:var(--brand)}
.chat .answer{padding:10px 14px;background:var(--mist);border-radius:14px}
.save{margin-top:22px}.save p{margin:0 0 12px}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--border);color:var(--ink);text-decoration:none;font-weight:600;background:var(--surface)}
.button.primary{background:var(--brand);border-color:var(--brand);color:#fff}
.hint{color:var(--muted);font-size:14px;margin:12px 0 0!important}
.muted{color:var(--muted)}
.empty{text-align:center;padding:48px 0}.empty p{color:var(--muted)}
footer{max-width:760px;margin:0 auto;padding:8px 16px 40px;color:var(--faint);font-size:13px}footer p{margin:4px 0}footer a{color:var(--muted)}
@media (max-width:480px){.card{padding:16px}.actions .button{flex:1 1 100%}}
`
