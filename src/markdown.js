// Markdown from a shared note, as safe HTML. The text is the user's own, so it is never trusted:
// everything is escaped first and only a few constructs become tags (headings, lists, task boxes,
// bold, italic, inline code, code blocks, quotes, tables, http(s) links). No raw HTML, no images.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, char => ESCAPES[char])

// The desktop's evidence links, `[09:41](#t=id1,id2)`, mean nothing on the web.
const EVIDENCE = /\s*\[[^\]\n]*\]\(#t=[^)\s]*\)/g

function inline(raw) {
  const codes = []
  let text = escapeHTML(raw).replace(/`([^`\n]+)`/g, (_, code) => `\u0000${codes.push(code) - 1}\u0000`)
  text = text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, href) =>
      `<a href="${href}" rel="nofollow noopener noreferrer" target="_blank">${label}</a>`)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[Number(index)]}</code>`)
}

const isTableRow = line => /^\s*\|.*\|\s*$/.test(line)
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())

export function markdownToHTML(markdown) {
  const lines = String(markdown ?? '').replace(EVIDENCE, '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let list = null           // 'ul' | 'ol'
  let paragraph = []
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = [] } }
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      flushParagraph(); closeList()
      const code = []
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i])
      out.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`)
      continue
    }
    if (!line.trim()) { flushParagraph(); closeList(); continue }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph(); closeList()
      const level = Math.min(Math.max(heading[1].length, 2), 4)
      out.push(`<h${level}>${inline(heading[2].replace(/\s+#+\s*$/, ''))}</h${level}>`)
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushParagraph(); closeList(); out.push('<hr>'); continue }
    if (/^\s*>/.test(line)) {
      flushParagraph(); closeList()
      const quote = [line.replace(/^\s*>\s?/, '')]
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) quote.push(lines[++i].replace(/^\s*>\s?/, ''))
      out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`)
      continue
    }
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flushParagraph(); closeList()
      const head = cells(line)
      i++
      const rows = []
      while (i + 1 < lines.length && isTableRow(lines[i + 1])) rows.push(cells(lines[++i]))
      out.push(`<div class="table"><table><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${
        rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)
      continue
    }
    const item = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/)
    if (item) {
      flushParagraph()
      const kind = item[1] ? 'ul' : 'ol'
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind }
      const task = item[3].match(/^\[( |x|X)\]\s+(.*)$/)
      out.push(task
        ? `<li class="task${task[1] === ' ' ? '' : ' done'}"><span class="box" aria-hidden="true"></span>${inline(task[2])}</li>`
        : `<li>${inline(item[3])}</li>`)
      continue
    }
    if (list && /^\s{2,}\S/.test(line)) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, `<br>${inline(line.trim())}</li>`); continue }
    closeList()
    paragraph.push(line.trim())
  }
  flushParagraph(); closeList()
  return out.join('\n')
}
