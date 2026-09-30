// Static pages come from public/; only /download/* runs code.
import { download } from './download.js'

export default {
  async fetch(request, env) {
    const match = new URL(request.url).pathname.match(/^\/download\/([a-z]+)\/?$/)
    if (match) return download(match[1])
    return env.ASSETS.fetch(request)
  },
}
