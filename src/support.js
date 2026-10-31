// The /ho-tro form: a report or a question from someone using VietNote, sent as an
// email to support@ with Reply-To set to their address, so answering it is just
// replying. Sending needs the Worker secret RESEND_API_KEY; without it the page
// falls back to opening the person's own email app.

const KINDS = new Map([['bug', 'Báo lỗi'], ['help', 'Cần hỗ trợ'], ['idea', 'Góp ý']])
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const TO = 'support@vietnote.vn'
const FROM = 'VietNote <no-reply@vietnote.vn>'

export async function sendSupport(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed' }, 403)
  if (!env.RESEND_API_KEY) return json({ error: 'Support email is not configured' }, 503)

  let body
  try {
    const raw = await request.text()
    if (raw.length > 12_000) return json({ error: 'Payload too large' }, 413)
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  // Bots commonly complete fields hidden from people. Pretend success without sending it.
  if (body.website) return json({ ok: true })

  const kind = KINDS.get(body.kind)
  const message = clean(body.message, 4000)
  const email = clean(body.email, 254).toLowerCase()
  if (!kind || message.length < 5 || !EMAIL.test(email)) return json({ error: 'Invalid message' }, 422)
  const version = clean(body.version, 40)
  const os = clean(body.os, 80)

  const firstLine = message.split('\n')[0].slice(0, 70)
  const text = [
    message, '',
    '—',
    `Loại: ${kind}`,
    `Email: ${email}`,
    `Phiên bản: ${version || 'không rõ'}`,
    `Hệ điều hành: ${os || 'không rõ'}`,
    `Trình duyệt: ${clean(request.headers.get('User-Agent'), 300)}`,
  ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject: `[${kind}] ${firstLine}`, text }),
  })
  if (!response.ok) {
    console.error('Support email failed', response.status, await response.text())
    return json({ error: 'Could not send' }, 502)
  }
  return json({ ok: true }, 201)
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } })
}
