// Builds the blog: blog/*.html (front matter + body) becomes public/blog/<slug>.html,
// the list at public/blog/index.html, public/blog/feed.xml and the sitemap entries.
// node scripts/blog.mjs          write the pages
// node scripts/blog.mjs --check  fail when the pages are out of date
// node scripts/blog.mjs --png    also render each cover to public/blog/<slug>.png for link
//                                previews (needs Chrome; CHROME=/path/to/chrome to override)
// A post's cover is the HTML between <!-- cover --> and <!-- /cover --> at the top of its body.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
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
  const cover = match[2].match(/<!-- cover -->\n?([\s\S]*?)\n?<!-- \/cover -->\n*/)
  const body = match[2].replace(cover?.[0] ?? '', '').trim()
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  const slug = file.replace(/\.html$/, '')
  return {
    ...meta, slug, body, cover: cover?.[1].trim() ?? '', minutes: Math.max(1, Math.round(words / 220)),
    image: existsSync(join(ROOT, `public/blog/${slug}.png`)) ? `/blog/${slug}.png` : '/assets/og-v3.jpg',
  }
}

const indent = (html, spaces) => html.replace(/^(?=.)/gm, ' '.repeat(spaces))

function page({ title, description, path, type = 'website', image = '/assets/og-v3.jpg', extraHead = '', main, script = '' }) {
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
  <meta property="og:image" content="${SITE}${image}">
  <meta name="twitter:card" content="summary_large_image">
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
// Optional front matter `version: 0.8.7` names the release a post is about.
const versionChip = post => post.version ? `<span class="post-version">v${escape(post.version)}</span>` : ''
const meta = post => `<p class="post-meta">${tagChip(post.tag)}<time datetime="${post.date}">${shortDate(post.date)}</time>${versionChip(post)}<span>${post.minutes} phút đọc</span></p>`
const cardMeta = post => `<p class="post-meta">${tagChip(post.tag)}${versionChip(post)}<span>${post.minutes} phút đọc</span></p>`
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']

function postPage(post) {
  const main = `  <main class="post">
    <a class="post-back" href="/blog/">← Tất cả bài viết</a>
    <article>
      <header class="post-head">
        ${meta(post)}
        <h1>${escape(post.title)}</h1>
        <p class="post-lede">${escape(post.description)}</p>
      </header>${post.cover ? `
      <div class="post-cover" aria-hidden="true">
${indent(post.cover, 8)}
      </div>` : ''}
      <div class="post-body">
${indent(post.body, 8)}
      </div>
    </article>
    <p class="post-end">Bạn có góp ý hay gặp lỗi? <a href="/ho-tro">Gửi cho chúng tôi</a>, mỗi góp ý đều được đọc.</p>
  </main>`
  return page({
    title: `${post.title} · Blog VietNote`, description: post.description, path: `/blog/${post.slug}`, type: 'article', image: post.image,
    extraHead: `\n  <meta property="article:published_time" content="${post.date}">`, main,
  })
}

function indexPage(posts) {
  const item = post => {
    const [, m, d] = post.date.split('-')
    const text = `${cardMeta(post)}
        <h2>${escape(post.title)}</h2>
        <p>${escape(post.description)}</p>`
    const card = post.cover
      ? `<a class="post-card has-cover" href="/blog/${post.slug}">
          <div class="post-thumb" aria-hidden="true">
${indent(post.cover, 12)}
          </div>
          <div>
          ${text}
          </div>
        </a>`
      : `<a class="post-card" href="/blog/${post.slug}">
          ${text}
        </a>`
    return `        <li class="tl-item" data-tag="${TAGS[post.tag]}">
          <time class="tl-date" datetime="${post.date}"><b>${+d}</b>Th${+m}</time><i class="tl-dot ${TAGS[post.tag]}" aria-hidden="true"></i>
          ${card}
        </li>`
  }
  // Newest month first, newest post first; blog.js can flip both.
  const months = [...new Set(posts.map(post => post.date.slice(0, 7)))]
  const items = months.map(month => {
    const [y, m] = month.split('-')
    return `    <section class="tl-month">
      <h2 class="tl-month-label">${MONTHS[m - 1]}, ${y}</h2>
      <ol class="post-list">
${posts.filter(post => post.date.startsWith(month)).map(item).join('\n')}
      </ol>
    </section>`
  }).join('\n')
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
    <p class="blog-order">Mới biết VietNote? <button type="button" class="blog-sort" data-oldest="false">Xem từ ngày đầu tiên ↓</button></p>
    <div class="timeline">
${items}
    </div>
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

// Each cover alone at 1200×630, styled as on the site, for link previews.
function renderCovers(posts) {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const dir = mkdtempSync(join(tmpdir(), 'blog-cover-'))
  const css = name => pathToFileURL(join(ROOT, 'public', name)).href
  for (const post of posts.filter(p => p.cover)) {
    const html = join(dir, `${post.slug}.html`)
    writeFileSync(html, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="${css('styles.css')}"><link rel="stylesheet" href="${css('blog.css')}">
<style>html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #15111a; } .atmosphere { display: none; }</style>
<body>${post.cover}</body>`)
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630',
      '--virtual-time-budget=4000', `--screenshot=${join(ROOT, `public/blog/${post.slug}.png`)}`, pathToFileURL(html).href], { stdio: 'ignore' })
    console.log(`cover → public/blog/${post.slug}.png`)
  }
}

if (process.argv.includes('--png')) {
  mkdirSync(join(ROOT, 'public/blog'), { recursive: true })
  renderCovers(readdirSync(join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(readPost))
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
