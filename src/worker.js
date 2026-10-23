// Static pages come from public/; API, downloads and videos run code.
import { download } from './download.js'
import { admin } from './admin.js'

// Pages moved to vietnote.vn. workers.dev still serves everything installed apps call
// (/youtube-player, /download, /api, /assets), so only these pages redirect.
const SITE = 'https://vietnote.vn'
const PAGES = new Set(['', '/index', '/huong-dan', '/feedback', '/thanh-toan', '/admin', '/email-100-users'])

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    if (url.hostname.endsWith('.workers.dev') && PAGES.has(pathname.replace(/\/$/, '').replace(/\.html$/, ''))) {
      return Response.redirect(`${SITE}${pathname}${url.search}`, 301)
    }
    if (pathname === '/api/feedback' || pathname === '/api/feedback/') return saveFeedback(request, env)
    if (pathname.startsWith('/api/admin/')) return admin(request, env, pathname.slice('/api/admin/'.length))
    const match = pathname.match(/^\/download\/([a-z]+)\/?$/)
    if (match) return download(match[1], request, env, ctx)
    if (pathname === '/youtube-player' || pathname === '/youtube-player/') {
      const asset = await env.ASSETS.fetch(request)
      const headers = new Headers(asset.headers)
      headers.delete('X-Frame-Options')
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers })
    }
    const response = await env.ASSETS.fetch(request)
    return pathname.endsWith('.mp4') ? withRange(request, response) : response
  },
}

const USE_CASES = new Set([
  'Họp online', 'Học tập / khóa học', 'Xem video nước ngoài',
  'Phỏng vấn / nghiên cứu', 'Viết tài liệu', 'Khác',
])
const OCCUPATIONS = new Set([
  'Sinh viên / học viên', 'Nhân viên văn phòng', 'Quản lý / chủ doanh nghiệp',
  'Giáo viên / giảng viên', 'Nghiên cứu / phỏng vấn', 'Nhà sáng tạo nội dung',
  'Lập trình viên / kỹ thuật', 'Khác',
])

async function saveFeedback(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' })

  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed' }, 403)
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return json({ error: 'Feedback service is not configured' }, 503)

  let body
  try {
    const raw = await request.text()
    if (raw.length > 12_000) return json({ error: 'Payload too large' }, 413)
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // Bots commonly complete fields hidden from people. Pretend success without storing it.
  if (body.website) return json({ ok: true })

  const rating = Number(body.rating)
  const nps = Number(body.nps)
  const useCase = Array.isArray(body.use_case) ? [...new Set(body.use_case.filter(value => USE_CASES.has(value)))].slice(0, 6) : []
  const occupation = OCCUPATIONS.has(body.occupation) ? body.occupation : null
  const mostUseful = clean(body.most_useful, 800)
  const friction = clean(body.friction, 1000)
  const featureRequest = clean(body.feature_request, 1000)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !Number.isInteger(nps) || nps < 0 || nps > 10 || !mostUseful) {
    return json({ error: 'Invalid feedback' }, 422)
  }

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/feedback_responses`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      rating,
      use_case: useCase,
      occupation,
      most_useful: mostUseful,
      friction,
      feature_request: featureRequest,
      nps,
      source: 'first_100',
    }),
  })

  if (!response.ok) {
    console.error('Supabase feedback insert failed', response.status, await response.text())
    return json({ error: 'Could not save feedback' }, 502)
  }
  return json({ ok: true }, 201)
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extraHeaders },
  })
}

// The asset server answers a Range request with the whole file, so browsers can't seek.
// Serve the requested byte range ourselves (206), as video players expect.
async function withRange(request, response) {
  if (response.status !== 200) return response
  const headers = new Headers(response.headers)
  headers.set('Accept-Ranges', 'bytes')
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '')
  if (!range || (!range[1] && !range[2])) return new Response(response.body, { status: 200, headers })

  const body = await response.arrayBuffer()
  const size = body.byteLength
  let start, end
  if (range[1]) {
    start = Number(range[1])
    end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  } else {
    start = Math.max(0, size - Number(range[2]))   // bytes=-N: the last N bytes
    end = size - 1
  }
  if (start >= size || start > end) {
    headers.set('Content-Range', `bytes */${size}`)
    headers.delete('Content-Length')
    return new Response(null, { status: 416, headers })
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers })
}
