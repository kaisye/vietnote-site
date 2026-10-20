// /download/mac and /download/windows stream the latest release installer
// from this domain, so visitors never see where the files are stored.
const FILES = {
  mac: { asset: 'VietNote_aarch64.dmg', name: 'VietNote.dmg', type: 'application/x-apple-diskimage' },
  windows: { asset: 'VietNote_x64-setup.exe', name: 'VietNote-Setup.exe', type: 'application/vnd.microsoft.portable-executable' },
}
const RELEASES = 'https://github.com/kaisye/VietNote/releases/latest/download'
// Crawlers and link previews follow download links too; they are not downloads.
const ROBOTS = /bot|crawl|spider|preview|facebookexternalhit|zalo|slurp|curl|wget|python|headless/i

export async function download(platform, request, env, ctx) {
  const file = FILES[platform]
  if (!file) return new Response('Not found', { status: 404 })
  const upstream = await fetch(`${RELEASES}/${file.asset}`, { cf: { cacheEverything: true, cacheTtl: 600 } })
  if (!upstream.ok) {
    return new Response('Bản cài đặt đang được cập nhật, vui lòng thử lại sau ít phút.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  if (request.method === 'GET' && !ROBOTS.test(request.headers.get('User-Agent') || '')) ctx.waitUntil(count(platform, env))
  const headers = new Headers({
    'Content-Type': file.type,
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'Cache-Control': 'no-store',
  })
  const length = upstream.headers.get('Content-Length')
  if (length) headers.set('Content-Length', length)
  return new Response(upstream.body, { headers })
}

// Counted after the response starts, so a slow or failing count never delays the download.
async function count(platform, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/record_download`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_platform: platform }),
  }).catch(error => ({ ok: false, status: String(error) }))
  if (!response.ok) console.error('record_download failed', response.status)
}
