// Signs the admin in, then draws the dashboard from /api/admin/data.
const $ = selector => document.querySelector(selector)
const form = $('.login')
const dashboard = $('.dashboard')
const loading = $('.loading')
const actions = $('.actions')

const number = new Intl.NumberFormat('vi-VN')
const vnd = value => `${number.format(Math.round(value || 0))}đ`
const short = value => Math.abs(value) >= 1e6 ? `${(value / 1e6).toFixed(1).replace('.0', '')}tr` : Math.abs(value) >= 1e3 ? `${Math.round(value / 1e3)}k` : String(Math.round(value))
const dayLabel = day => { const [, m, d] = day.split('-'); return `${Number(d)}/${Number(m)}` }
const percent = (part, whole) => whole ? `${Math.round(100 * part / whole)}%` : '–'
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const FEATURES = {
  live_translate: 'Dịch trực tiếp', meeting_note: 'Ghi chú họp', file_note: 'File ghi âm',
  watch_listen: 'Xem video (nghe)', watch_captions: 'Xem video (phụ đề)', watch_chat: 'Hỏi về video',
  summary: 'Tóm tắt', title: 'Đặt tiêu đề', note_chat: 'Hỏi ghi chú', live_chat: 'Hỏi trong họp',
  translate_paragraph: 'Dịch đoạn', writer: 'Viết tài liệu', han_repair: 'Sửa chữ Hán', unknown: 'Chưa rõ (bản cũ)',
}

async function load() {
  const response = await fetch('/api/admin/data', { credentials: 'same-origin' })
  loading.hidden = true
  if (response.status === 401) { showLogin(); return }
  if (!response.ok) {
    loading.hidden = false
    loading.textContent = response.status === 503 ? 'Trang quản trị chưa được cài đặt đủ trên máy chủ (tài khoản hoặc kết nối dữ liệu).' : 'Không tải được dữ liệu. Thử làm mới sau ít phút.'
    return
  }
  render(await response.json())
}

function showLogin() {
  dashboard.hidden = true; actions.hidden = true; form.hidden = false
  form.user.focus()
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  const button = form.querySelector('button')
  button.disabled = true; form.querySelector('.error').textContent = ''
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: form.user.value, password: form.password.value }),
    })
    if (!response.ok) { form.querySelector('.error').textContent = (await response.json().catch(() => ({}))).error || 'Không đăng nhập được'; return }
    form.reset(); form.hidden = true; loading.hidden = false
    await load()
  } finally { button.disabled = false }
})

$('[data-logout]').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
  showLogin()
})
$('[data-refresh]').addEventListener('click', () => load())

function render(data) {
  form.hidden = true; dashboard.hidden = false; actions.hidden = false
  $('.updated').textContent = `Cập nhật ${new Date(data.generated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
  const k = data.kpis
  const margin = k.revenue_vnd - k.cost_vnd
  const margin7 = k.revenue_7d - k.cost_7d
  $('.kpis').innerHTML = [
    ['Người dùng', number.format(k.users), `+${number.format(k.new_7d)} trong 7 ngày`],
    ['Hoạt động hôm nay', number.format(k.active_today), `Hôm qua ${number.format(k.active_yesterday)}`],
    ['Người mua', number.format(k.buyers), `${percent(k.buyers, k.users)} người dùng`],
    ['Doanh thu', vnd(k.revenue_vnd), `7 ngày: ${vnd(k.revenue_7d)}`],
    ['Chi phí', vnd(k.cost_vnd), `7 ngày: ${vnd(k.cost_7d)}`],
    ['Lãi gộp', `<span class="${margin >= 0 ? 'good' : 'bad'}">${vnd(margin)}</span>`, `7 ngày: <span class="${margin7 >= 0 ? 'good' : 'bad'}">${vnd(margin7)}</span>`],
    ['Giờ chưa dùng', number.format(k.hours_left), 'Số giờ trong tài khoản'],
  ].map(([label, value, note]) => `<div class="card kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('')

  $('.insights').innerHTML = insights(data).map(item => `<li class="${item.level}"><i></i><div><b>${item.title}</b><p>${item.detail}</p>${item.action ? `<p class="next">→ ${item.action}</p>` : ''}</div></li>`).join('')

  bars($('[data-chart="users"]'), data.daily, [
    { key: 'active', label: 'Hoạt động', color: 'var(--pink)' },
    { key: 'signups', label: 'Đăng ký mới', color: 'var(--signups)' },
  ], number.format)
  bars($('[data-chart="money"]'), data.daily, [
    { key: 'revenue', label: 'Doanh thu', color: 'var(--pink)' },
    { key: 'cost', label: 'Chi phí', color: 'var(--cost)' },
  ], vnd)

  table($('[data-table="features"]'), ['Tính năng', 'Người dùng', 'Giờ', 'Lượt AI', 'Chi phí'], data.features
    .filter(f => f.hours > 0 || f.ai_requests > 0)
    .map(f => [FEATURES[f.feature] || f.feature, number.format(f.users), number.format(f.hours), number.format(f.ai_requests), vnd(f.cost_vnd)]))

  table($('[data-table="cohorts"]'), ['Ngày đăng ký', 'Đăng ký', 'Dùng thử', 'Hôm sau', 'Trong 7 ngày'], data.cohorts.slice().reverse()
    .map(c => ({ row: [dayLabel(c.day), c.signed_up, `${c.tried} · ${percent(c.tried, c.signed_up)}`,
      c.age_days >= 2 ? `${c.day1} · ${percent(c.day1, c.tried)}` : '–',
      `${c.week1} · ${percent(c.week1, c.tried)}`], young: c.age_days < 8 })))

  table($('[data-table="top_users"]'), ['Email', 'Đã trả', 'Giờ dùng', 'Chi phí', 'Giờ còn'], data.top_users
    .map(u => [u.email, vnd(u.revenue_vnd), number.format(u.hours_used), vnd(u.cost_vnd), number.format(u.hours_left)]))

  table($('[data-table="orders"]'), ['Thời gian', 'Email', 'Gói', 'Số tiền'], data.orders
    .map(o => [new Date(o.paid_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), o.email, o.package_id, vnd(o.amount_vnd)]), [1, 2])
}

// Columns after the first are numbers unless listed in `text`.
// Observations and next steps from the numbers on the page, by fixed rules.
function insights(data) {
  const k = data.kpis
  const list = []
  const add = (level, title, detail, action) => list.push({ level, title, detail, action })
  const sum = (items, key) => items.reduce((total, item) => total + (Number(item[key]) || 0), 0)

  // Money over the last 7 days.
  const margin7 = k.revenue_7d - k.cost_7d
  if (k.revenue_7d || k.cost_7d) {
    const share = k.revenue_7d ? margin7 / k.revenue_7d : -1
    if (margin7 < 0) add('bad', `Lỗ ${vnd(-margin7)} trong 7 ngày`, `Chi phí ${vnd(k.cost_7d)} vượt doanh thu ${vnd(k.revenue_7d)}.`, 'Giảm giờ tặng cho người đăng ký mới hoặc tăng giá gói lớn.')
    else if (share < .3) add('warn', `Lãi gộp 7 ngày chỉ ${Math.round(share * 100)}%`, `Lãi ${vnd(margin7)} trên doanh thu ${vnd(k.revenue_7d)}, chưa tính phí thanh toán.`, 'Xem lại giá gói lớn và các tính năng tốn chi phí nhất bên dưới.')
    else add('good', `Lãi gộp 7 ngày ${Math.round(share * 100)}%`, `Lãi ${vnd(margin7)} trên doanh thu ${vnd(k.revenue_7d)}.`)
  }

  // Activity trend: the last 7 complete days against the 7 before. Today is still running.
  const complete = data.daily.slice(0, -1)
  const recent = complete.slice(-7), before = complete.slice(-14, -7)
  const recentAvg = sum(recent, 'active') / 7, beforeAvg = sum(before, 'active') / 7
  if (beforeAvg >= 3) {
    const change = recentAvg / beforeAvg - 1
    const detail = `Trung bình ${number.format(Math.round(recentAvg))} người/ngày, so với ${number.format(Math.round(beforeAvg))} của 7 ngày trước.`
    if (change >= .2) add('good', change >= 1 ? `Người dùng hoạt động gấp ${(recentAvg / beforeAvg).toFixed(1).replace('.0', '').replace('.', ',')} lần tuần trước` : `Người dùng hoạt động tăng ${Math.round(change * 100)}%`, detail, 'Tranh thủ lúc đông người: nhắc mua gói khi sắp hết giờ tặng, xin góp ý từ người dùng mới.')
    else if (change <= -.2) add('bad', `Người dùng hoạt động giảm ${Math.round(-change * 100)}%`, detail, 'Gửi email nhắc những người đã dùng thử nhưng chưa quay lại, kèm gợi ý cách dùng cụ thể.')
    else add('info', 'Người dùng hoạt động đi ngang', detail)
  }

  // First use and coming back, from sign-up cohorts old enough to judge.
  const cohorts = data.cohorts.filter(c => c.age_days >= 1)
  const signed = sum(cohorts, 'signed_up'), tried = sum(cohorts, 'tried')
  if (signed >= 20) {
    const rate = tried / signed
    const detail = `${number.format(tried)}/${number.format(signed)} người đăng ký trong 2 tuần đã thực sự dùng (${Math.round(rate * 100)}%).`
    if (rate < .6) add('warn', 'Nhiều người đăng ký nhưng chưa dùng', detail, 'Kiểm tra bước cài đặt và cấp quyền micro/âm thanh; gửi email hướng dẫn lần dùng đầu.')
    else add('good', 'Lần dùng đầu tốt', detail)
  }
  const mature = data.cohorts.filter(c => c.age_days >= 8)
  const matureTried = sum(mature, 'tried')
  if (matureTried >= 20) {
    const rate = sum(mature, 'week1') / matureTried
    const detail = `${Math.round(rate * 100)}% người dùng thử quay lại trong 7 ngày đầu (nhóm đã đủ 7 ngày, ${number.format(matureTried)} người). Mức tốt cho ứng dụng năng suất là trên 20%.`
    if (rate < .1) add('bad', 'Ít người quay lại sau lần đầu', detail, 'Nhắc người dùng sau buổi đầu tiên: còn bao nhiêu phút, nên dùng cho việc gì tiếp theo.')
    else if (rate < .2) add('warn', 'Tỷ lệ quay lại còn thấp', detail, 'Gửi email gợi ý cách dùng tiếp cho người đã dùng thử 1 lần.')
    else add('good', 'Người dùng quay lại tốt', detail)
  } else {
    const early = data.cohorts.filter(c => c.age_days >= 2)
    const earlyTried = sum(early, 'tried')
    if (earlyTried >= 20) {
      const rate = sum(early, 'day1') / earlyTried
      const detail = `${Math.round(rate * 100)}% người dùng thử quay lại ngay hôm sau (${number.format(earlyTried)} người). Chưa đủ nhóm 7 ngày để đánh giá đầy đủ.`
      add(rate < .08 ? 'bad' : rate < .15 ? 'warn' : 'good', rate < .15 ? 'Ít người quay lại hôm sau' : 'Nhiều người quay lại hôm sau', detail,
        rate < .15 ? 'Gửi email nhắc trong 1–2 ngày sau lần dùng đầu.' : '')
    }
  }

  // Paying.
  if (k.users >= 50) {
    const rate = k.buyers / k.users
    const detail = `${number.format(k.buyers)}/${number.format(k.users)} người dùng đã mua (${(rate * 100).toFixed(1)}%), trung bình ${vnd(k.buyers ? k.revenue_vnd / k.buyers : 0)} mỗi người mua.`
    if (rate < .03) add('warn', 'Tỷ lệ mua thấp', detail, 'Nhắc mua khi còn khoảng 15 phút, ưu đãi cho lần mua đầu.')
    else add('good', 'Tỷ lệ mua tốt', detail)
  }

  // Heavy users who have not paid.
  const free = data.top_users.filter(u => !u.revenue_vnd)
  const topCost = sum(data.top_users, 'cost_vnd')
  if (free.length >= 5 && topCost > 0) {
    add('warn', `${free.length}/${data.top_users.length} người tốn chi phí nhất chưa trả tiền`,
      `Họ chiếm ${Math.round(100 * sum(free, 'cost_vnd') / topCost)}% chi phí của nhóm này.`,
      'Kiểm tra có tài khoản nào tạo nhiều lần để lấy giờ tặng; cân nhắc giới hạn giờ tặng.')
  }

  // What the hours already sold or given would cost if all were used.
  const hours = sum(data.features, 'hours'), featureCost = sum(data.features, 'cost_vnd')
  if (hours >= 1 && k.hours_left > 0) {
    const perHour = featureCost / hours
    const exposure = k.hours_left * perHour
    add(exposure > k.revenue_vnd ? 'warn' : 'info', `Giờ chưa dùng tương đương ~${vnd(exposure)} chi phí`,
      `${number.format(k.hours_left)} giờ trong tài khoản × ~${vnd(perHour)} mỗi giờ (chi phí trung bình 7 ngày qua). Thường chỉ một phần nhỏ được dùng hết.`,
      exposure > k.revenue_vnd ? 'Không tặng thêm giờ hàng loạt; theo dõi lãi gộp hằng ngày.' : '')
  }

  // The feature that drives cost.
  const costly = data.features.slice().sort((a, b) => b.cost_vnd - a.cost_vnd)[0]
  if (costly && featureCost > 0 && costly.cost_vnd / featureCost >= .4) {
    add('info', `${FEATURES[costly.feature] || costly.feature} chiếm ${Math.round(100 * costly.cost_vnd / featureCost)}% chi phí 7 ngày`,
      `${number.format(costly.hours)} giờ, ${number.format(costly.users)} người dùng.`, 'Tối ưu chi phí của tính năng này mang lại nhiều nhất.')
  }

  const order = { bad: 0, warn: 1, good: 2, info: 3 }
  return list.sort((a, b) => order[a.level] - order[b.level])
}

function table(element, headings, rows, text = []) {
  const numeric = index => index > 0 && !text.includes(index)
  element.innerHTML = `<thead><tr>${headings.map((h, i) => `<th class="${numeric(i) ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${
    rows.length ? rows.map(item => {
      const { row, young } = Array.isArray(item) ? { row: item, young: false } : item
      return `<tr class="${young ? 'young' : ''}">${row.map((cell, i) => `<td class="${numeric(i) ? 'num' : ''}">${escape(cell)}</td>`).join('')}</tr>`
    }).join('') : `<tr><td colspan="${headings.length}">Chưa có dữ liệu</td></tr>`}</tbody>`
}

// Grouped bars, one group per day, with a tooltip on hover or tap.
function bars(element, days, series, format) {
  const width = 640, height = 220, left = 40, bottom = 22, top = 8
  const max = Math.max(1, ...days.flatMap(d => series.map(s => d[s.key])))
  const step = (width - left) / days.length
  const bar = Math.max(2, (step - 4) / series.length)
  const y = value => top + (height - top - bottom) * (1 - value / max)
  const ticks = [0, max / 2, max]
  const svg = [`<svg viewBox="0 0 ${width} ${height}" role="img">`]
  for (const tick of ticks) svg.push(`<line class="grid-line" x1="${left}" x2="${width}" y1="${y(tick)}" y2="${y(tick)}"/><text x="${left - 6}" y="${y(tick) + 4}" text-anchor="end">${short(tick)}</text>`)
  days.forEach((d, i) => {
    const x = left + i * step + 2
    svg.push(`<g class="bar-group" data-index="${i}"><rect x="${left + i * step}" y="${top}" width="${step}" height="${height - top - bottom}" fill="transparent"/>`)
    series.forEach((s, j) => svg.push(`<rect x="${x + j * bar}" y="${y(d[s.key])}" width="${bar}" height="${Math.max(0, y(0) - y(d[s.key]))}" rx="1.5" fill="${s.color}"/>`))
    svg.push('</g>')
    const every = Math.ceil(days.length / 8)
    if (i % every === 0 || (i === days.length - 1 && i % every >= every / 2)) svg.push(`<text x="${x + step / 2 - 2}" y="${height - 6}" text-anchor="middle">${dayLabel(d.day)}</text>`)
  })
  svg.push('</svg>')
  element.innerHTML = svg.join('') + '<div class="tooltip" hidden></div>'
  const tooltip = element.querySelector('.tooltip')
  const show = event => {
    const group = event.target.closest('.bar-group')
    if (!group) { tooltip.hidden = true; return }
    const d = days[Number(group.dataset.index)]
    tooltip.innerHTML = `<b>${dayLabel(d.day)}</b><br>${series.map(s => `${s.label}: ${format(d[s.key])}`).join('<br>')}`
    const box = element.getBoundingClientRect()
    tooltip.style.left = `${Math.min(Math.max(event.clientX - box.left, 70), box.width - 70)}px`
    tooltip.style.top = `${event.clientY - box.top - 10}px`
    tooltip.hidden = false
  }
  element.addEventListener('pointermove', show)
  element.addEventListener('pointerdown', show)
  element.addEventListener('pointerleave', () => { tooltip.hidden = true })
}

load().catch(() => { loading.textContent = 'Không tải được trang. Kiểm tra kết nối rồi tải lại.' })
