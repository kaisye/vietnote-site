// Builds the blog: blog/*.html (front matter + body) becomes public/blog/<slug>.html,
// the list at public/blog/index.html, public/blog/feed.xml and the sitemap entries.
// node scripts/blog.mjs          write the pages
// node scripts/blog.mjs --check  fail when the pages are out of date
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://vietnote.vn'
const TAGS = { 'Tính năng mới': 'news', 'Bài học': 'lesson' }

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const shortDate = date => { const [y, m, d] = date.split('-'); return `${+d}/${+m}/${y}` }

function readPost(file) {
  const source = readFileSync(join(ROOT, 'blog', file), 'utf8')
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${file}: missing front matter`)
  const meta = Object.fromEntries(match[1].split('\n').filter(Boolean).map(line => {
    const at = line.indexOf(':')
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
  }))
  for (const key of ['title', 'description', 'date', 'tag']) if (!meta[key]) throw new Error(`${file}: missing ${key}`)
  if (!TAGS[meta.tag]) throw new Error(`${file}: tag must be one of ${Object.keys(TAGS).join(', ')}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`)
  const body = match[2].trim()
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return { ...meta, slug: file.replace(/\.html$/, ''), body, minutes: Math.max(1, Math.round(words / 220)) }
}

function page({ title, description, path, type = 'website', extraHead = '', main, script = '' }) {
  const url = `${SITE}${path}`
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/assets/og-v3.jpg">
  <meta name="theme-color" content="#fbfbfc">${extraHead}
  <link rel="alternate" type="application/rss+xml" title="Blog VietNote" href="/blog/feed.xml">
  <script>try { if (localStorage.getItem('vietnote.theme') === 'dark') document.documentElement.dataset.theme = 'dark' } catch {}</script>
  <link rel="icon" href="/assets/logo-v3.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/blog.css">
  <script src="/config.js" defer></script>
  <script src="/app.js" defer></script>${script}
</head>
<body>
  <div class="atmosphere" aria-hidden="true"><i class="glow g1"></i><i class="glow g2"></i><i class="grid"></i></div>

  <header class="nav" id="nav">
    <div class="nav-inner">
      <a class="brand" href="/" aria-label="VietNote, trang chủ">
        <img class="mark" src="/assets/logo-v3.svg" alt="" width="30" height="30">
        <span>VietNote</span>
      </a>
      <nav>
        <a href="/#tinh-nang">Tính năng</a>
        <a href="/huong-dan">Hướng dẫn</a>
        <a href="/blog/" aria-current="page">Blog</a>
        <a href="/#bang-gia">Bảng giá</a>
      </nav>
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Chuyển giao diện sáng/tối">
        <svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>
        <svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <a class="btn btn-primary btn-small" href="/#tai-ve">Tải về</a>
    </div>
  </header>

${main}

  <footer class="footer">
    <a class="brand" href="/"><img class="mark" src="/assets/logo-v3.svg" alt="" width="30" height="30"><span>VietNote</span></a>
    <span>© <span data-year>2026</span> VietNote</span>
    <a href="/huong-dan">Hướng dẫn</a>
    <a href="/blog/">Blog</a>
    <a href="/quyen-rieng-tu">Quyền riêng tư</a>
    <a href="https://www.facebook.com/app.vietnote/" target="_blank" rel="noopener">Facebook</a>
    <a href="mailto:support@vietnote.vn">support@vietnote.vn</a>
  </footer>
</body>
</html>
`
}

const tagChip = tag => `<span class="post-tag ${TAGS[tag]}">${tag}</span>`
const meta = post => `<p class="post-meta">${tagChip(post.tag)}<time datetime="${post.date}">${shortDate(post.date)}</time><span>${post.minutes} phút đọc</span></p>`

function postPage(post) {
  const main = `  <main class="post">
    <a class="post-back" href="/blog/">← Tất cả bài viết</a>
    <article>
      <header class="post-head">
        ${meta(post)}
        <h1>${escape(post.title)}</h1>
        <p class="post-lede">${escape(post.description)}</p>
      </header>
      <div class="post-body">
${post.body.replace(/^/gm, '        ')}
      </div>
    </article>
    <p class="post-end">Bạn có góp ý hay gặp lỗi? <a href="/ho-tro">Gửi cho chúng tôi</a>, mỗi góp ý đều được đọc.</p>
  </main>`
  return page({
    title: `${post.title} · Blog VietNote`, description: post.description, path: `/blog/${post.slug}`, type: 'article',
    extraHead: `\n  <meta property="article:published_time" content="${post.date}">`, main,
  })
}

function indexPage(posts) {
  const items = posts.map(post => `      <li data-tag="${TAGS[post.tag]}"><a class="post-card" href="/blog/${post.slug}">
        ${meta(post)}
        <h2>${escape(post.title)}</h2>
        <p>${escape(post.description)}</p>
      </a></li>`).join('\n')
  const main = `  <main class="blog">
    <header class="blog-head">
      <h1>Blog</h1>
      <p>Có gì mới trong VietNote, và những bài học chúng tôi rút ra từ chính sai sót của mình.</p>
    </header>
    <div class="blog-filter" role="group" aria-label="Lọc bài viết">
      <button type="button" data-tag="" aria-pressed="true">Tất cả</button>
      <button type="button" data-tag="news" aria-pressed="false">Tính năng mới</button>
      <button type="button" data-tag="lesson" aria-pressed="false">Bài học</button>
    </div>
    <ul class="post-list">
${items}
    </ul>
  </main>`
  return page({
    title: 'Blog · VietNote',
    description: 'Tính năng mới của VietNote và những bài học rút ra từ sai sót khi làm ứng dụng phiên dịch, ghi chú cuộc họp.',
    path: "/blog/", main, script: '\n  <script src="/blog.js" defer></script>',
  })
}

function feed(posts) {
  const items = posts.map(post => `    <item>
      <title>${escape(post.title)}</title>
      <link>${SITE}/blog/${post.slug}</link>
      <guid>${SITE}/blog/${post.slug}</guid>
      <pubDate>${new Date(`${post.date}T08:00:00+07:00`).toUTCString()}</pubDate>
      <category>${post.tag}</category>
      <description>${escape(post.description)}</description>
    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog VietNote</title>
    <link>${SITE}/blog/</link>
    <description>Tính năng mới và bài học từ sai sót của VietNote.</description>
    <language>vi</language>
${items}
  </channel>
</rss>
`
}

function sitemap(posts) {
  const current = readFileSync(join(ROOT, 'public/sitemap.xml'), 'utf8')
  const entries = ['/blog/', ...posts.map(post => `/blog/${post.slug}`)]
    .map(path => `  <url><loc>${SITE}${path}</loc></url>`).join('\n')
  const block = `  <!-- blog: written by scripts/blog.mjs -->\n${entries}\n  <!-- /blog -->`
  return /  <!-- blog[\s\S]*?<!-- \/blog -->/.test(current)
    ? current.replace(/  <!-- blog[\s\S]*?<!-- \/blog -->/, block)
    : current.replace('</urlset>', `${block}\n</urlset>`)
}

const posts = readdirSync(join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(readPost)
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
const outputs = {
  'public/blog/index.html': indexPage(posts),
  'public/blog/feed.xml': feed(posts),
  'public/sitemap.xml': sitemap(posts),
  ...Object.fromEntries(posts.map(post => [`public/blog/${post.slug}.html`, postPage(post)])),
}

if (process.argv.includes('--check')) {
  const stale = Object.entries(outputs).filter(([path, text]) => !existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), 'utf8') !== text)
  if (stale.length) {
    console.error(`Out of date, run node scripts/blog.mjs:\n${stale.map(([path]) => `  ${path}`).join('\n')}`)
    process.exit(1)
  }
} else {
  mkdirSync(join(ROOT, 'public/blog'), { recursive: true })
  for (const [path, text] of Object.entries(outputs)) writeFileSync(join(ROOT, path), text)
  console.log(`${posts.length} posts → public/blog`)
}
