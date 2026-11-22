// node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { markdownToHTML } from '../src/markdown.js'
import { sharePage } from '../src/share.js'

const env = { SUPABASE_URL: 'https://example.supabase.co' }
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'
const reply = body => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

test('markdown never lets HTML or scripts through', () => {
  const html = markdownToHTML('## Tóm tắt <script>alert(1)</script>\n\n- [link](javascript:alert(1)) **đậm** <img src=x onerror=alert(1)>\n- [ok](https://vietnote.vn)\n\n<iframe src="x"></iframe>')
  assert.doesNotMatch(html, /<script|<img|<iframe|href="javascript:/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /<a href="https:\/\/vietnote.vn" rel="nofollow noopener noreferrer" target="_blank">ok<\/a>/)
  assert.match(html, /<strong>đậm<\/strong>/)
})

test('markdown renders the summary shapes VietNote writes', () => {
  const html = markdownToHTML('## Việc cần làm\n\n- [ ] An → Gửi bản dựng → Thứ Năm [02:31](#t=line-1)\n- [x] Xong\n\n1. Một\n2. Hai\n\n| A | B |\n|---|---|\n| 1 | 2 |')
  assert.match(html, /<h2>Việc cần làm<\/h2>/)
  assert.match(html, /<li class="task"><span class="box" aria-hidden="true"><\/span>An → Gửi bản dựng → Thứ Năm<\/li>/)
  assert.match(html, /<li class="task done">/)
  assert.match(html, /<ol>\n<li>Một<\/li>/)
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr>/)
  assert.doesNotMatch(html, /#t=/)
})

test('a shared note is a page with its title for link previews, and never indexed', async () => {
  const response = await sharePage(TOKEN, env, reply({ note: { format: 'vietnote.note/1', title: 'Họp <b>sprint</b>', createdAt: '2026-11-21T02:30:00.000Z', duration: 1820,
    summary: '## Tóm tắt nhanh\n\nChốt phát hành thứ Sáu.', lines: [{ id: 'l1', start: 12, text: 'Xin chào', speaker: 'An' }], chat: [{ id: 'c', role: 'user', text: 'Ai?' }] }, parts: ['summary'] }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  const html = await response.text()
  assert.match(html, /<meta property="og:title" content="Họp &lt;b&gt;sprint&lt;\/b&gt; · VietNote">/)
  assert.match(html, /<meta property="og:description" content="Tóm tắt nhanh Chốt phát hành thứ Sáu.">/)
  assert.match(html, /<h1>Họp &lt;b&gt;sprint&lt;\/b&gt;<\/h1>/)
  assert.match(html, /30 phút/)
  assert.match(html, /Lời chép · 1 câu/)
  assert.match(html, /Hỏi đáp · 1 tin/)
  assert.match(html, new RegExp(`vietnote://n/${TOKEN}`))
})

test('an expired, revoked or malformed link says so, without asking the server for a bad token', async () => {
  let asked = 0
  const fetcher = async () => { asked++; return new Response('null', { status: 200 }) }
  assert.equal((await sharePage(TOKEN, env, fetcher)).status, 404)
  assert.equal((await sharePage('../../etc', env, fetcher)).status, 404)
  assert.equal(asked, 1)
  const html = await (await sharePage(TOKEN, env, fetcher)).text()
  assert.match(html, /Link này không còn dùng được/)
  assert.doesNotMatch(html, /vietnote:\/\//)
})

test('a server problem is a retry page', async () => {
  assert.equal((await sharePage(TOKEN, env, async () => new Response('', { status: 500 }))).status, 503)
  assert.equal((await sharePage(TOKEN, env, async () => { throw new Error('down') })).status, 503)
})
