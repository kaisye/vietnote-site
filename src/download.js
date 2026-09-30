// /download/mac and /download/windows stream the latest release installer
// from this domain, so visitors never see where the files are stored.
const FILES = {
  mac: { asset: 'VietNote_aarch64.dmg', name: 'VietNote.dmg', type: 'application/x-apple-diskimage' },
  windows: { asset: 'VietNote_x64-setup.exe', name: 'VietNote-Setup.exe', type: 'application/vnd.microsoft.portable-executable' },
}
const RELEASES = 'https://github.com/kaisye/VietNote/releases/latest/download'

export async function download(platform) {
  const file = FILES[platform]
  if (!file) return new Response('Not found', { status: 404 })
  const upstream = await fetch(`${RELEASES}/${file.asset}`, { cf: { cacheEverything: true, cacheTtl: 600 } })
  if (!upstream.ok) {
    return new Response('Bản cài đặt đang được cập nhật, vui lòng thử lại sau ít phút.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const headers = new Headers({
    'Content-Type': file.type,
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'Cache-Control': 'no-store',
  })
  const length = upstream.headers.get('Content-Length')
  if (length) headers.set('Content-Length', length)
  return new Response(upstream.body, { headers })
}
