// Static pages come from public/; /download/* and videos run code.
import { download } from './download.js'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    const match = pathname.match(/^\/download\/([a-z]+)\/?$/)
    if (match) return download(match[1])
    const response = await env.ASSETS.fetch(request)
    return pathname.endsWith('.mp4') ? withRange(request, response) : response
  },
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
