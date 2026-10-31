// The /admin dashboard: one account whose name and password are Worker secrets
// (ADMIN_USER, ADMIN_PASSWORD). Signing in sets a signed session cookie; the
// data comes from Supabase's admin_dashboard() through the secret key, which
// never reaches the browser. Changing the password signs every session out.

const COOKIE = 'vn_admin'
const SESSION_SECONDS = 7 * 24 * 3600

export async function admin(request, env, action) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return json({ error: 'Admin is not configured' }, 503)
  if (request.method === 'POST') {
    const origin = request.headers.get('Origin')
    if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed' }, 403)
  }
  if (action === 'login' && request.method === 'POST') return login(request, env)
  if (action === 'logout' && request.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) })
  if (action === 'data' && request.method === 'GET') {
    if (!await signedIn(request, env)) return json({ error: 'Not signed in' }, 401)
    return dashboard(env)
  }
  return json({ error: 'Not found' }, 404)
}

async function login(request, env) {
  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const user = typeof body.user === 'string' ? body.user : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const ok = await same(user, env.ADMIN_USER) & await same(password, env.ADMIN_PASSWORD)
  if (!ok) {
    // Slows down password guessing.
    await new Promise(resolve => setTimeout(resolve, 800))
    return json({ error: 'Sai tài khoản hoặc mật khẩu' }, 401)
  }
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const token = `${expires}.${await sign(String(expires), env)}`
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(token, SESSION_SECONDS) })
}

async function signedIn(request, env) {
  const match = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`))
  if (!match || Number(match[1]) < Date.now() / 1000) return false
  return same(match[2], await sign(match[1], env))
}

async function dashboard(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return json({ error: 'Supabase is not configured' }, 503)
  const [response, ranges, heavy] = await Promise.all([rpc(env, 'admin_dashboard'), rpc(env, 'admin_feature_ranges'), rpc(env, 'admin_heavy_users')])
  if (!response.ok) {
    console.error('admin_dashboard failed', response.status, await response.text())
    return json({ error: 'Could not load data' }, 502)
  }
  // Without the ranges (say, before their migration runs) the page shows the 7-day table alone,
  // and without the heavy users, no table of them.
  const data = await response.json()
  if (ranges.ok) data.feature_ranges = await ranges.json()
  else console.error('admin_feature_ranges failed', ranges.status, await ranges.text())
  if (heavy.ok) data.heavy_users = await heavy.json()
  else console.error('admin_heavy_users failed', heavy.status, await heavy.text())
  return json(data)
}

function rpc(env, name) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  })
}

const encoder = new TextEncoder()

async function sign(value, env) {
  // Keyed by the credentials themselves, so a new password invalidates old cookies.
  const key = await crypto.subtle.importKey('raw', encoder.encode(`${env.ADMIN_USER}\n${env.ADMIN_PASSWORD}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Constant-time comparison: both sides are hashed to equal length first.
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map(value => crypto.subtle.digest('SHA-256', encoder.encode(String(value)))))
  return crypto.subtle.timingSafeEqual(x, y)
}

function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } })
}
