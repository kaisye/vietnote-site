// Pricing from Supabase, the visitor's OS first among download buttons, and the release version.
(() => {
  const config = window.VIETNOTE
  const vnd = amount => `${new Intl.NumberFormat('vi-VN').format(amount)}đ`
  const hours = value => `${Number(value).toLocaleString('vi-VN')} giờ`
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear() })

  // Windows visitors see the Windows button first and highlighted.
  if (/Windows/i.test(navigator.userAgent)) {
    document.querySelectorAll('[data-downloads]').forEach(row => {
      const mac = row.querySelector('[data-os="mac"]'), win = row.querySelector('[data-os="windows"]')
      if (!mac || !win) return
      mac.classList.replace('btn-primary', 'btn-ghost'); win.classList.replace('btn-ghost', 'btn-primary')
      row.prepend(win)
    })
  }

  // Signup bonus from Supabase (app_settings), so it changes without a deploy.
  const rpc = name => fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  }).then(response => response.ok ? response.json() : Promise.reject(response.status))

  if (config && document.querySelector('[data-signup-bonus]')) {
    rpc('signup_bonus_minutes').then(minutes => {
      if (!Number.isInteger(minutes) || minutes <= 0) return
      document.querySelectorAll('[data-signup-bonus]').forEach(el => { el.textContent = `${minutes} phút` })
    }).catch(() => {})
  }

  // Light by default; the toggle remembers the choice for this browser.
  const toggle = document.getElementById('theme-toggle')
  if (toggle) toggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark'
    if (dark) document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111022' : '#ffffff'
    try { localStorage.setItem('vietnote.theme', dark ? 'dark' : 'light') } catch {}
  })

  // Downloading: the installer keeps downloading while that OS's install video plays.
  document.querySelectorAll('dialog.guide[data-os]').forEach(guide => {
    if (typeof guide.showModal !== 'function') return
    const video = guide.querySelector('video')
    document.querySelectorAll(`[data-downloads] [data-os="${guide.dataset.os}"]`).forEach(link => link.addEventListener('click', () => {
      document.querySelectorAll('video').forEach(v => { if (v !== video) v.pause() })
      guide.showModal()
      video.currentTime = 0
      video.play().catch(() => {})
    }))
    guide.addEventListener('click', event => {
      const box = guide.getBoundingClientRect()
      const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
      if ((event.target === guide && outside) || event.target.closest('[data-close]')) guide.close()
    })
    guide.addEventListener('close', () => video.pause())
  })

  const pricing = document.querySelector('[data-pricing]')
  if (pricing && config) {
    rpc('credit_offers').catch(() => []).then(offers => {
      pricing.insertAdjacentHTML('beforeend', offers.map(offer => {
        const total = Number(offer.hours) + Number(offer.bonus_hours)
        const perHour = Math.round(offer.price_vnd / total / 100) * 100
        const ends = offer.promo_ends_at ? `<span class="ends">Đến hết ${new Date(offer.promo_ends_at).toLocaleDateString('vi-VN')}</span>` : ''
        return `<article class="plan ${offer.highlight ? 'highlight' : ''}">
          ${offer.promo_label ? `<span class="tag">${escape(offer.promo_label)}</span>` : offer.highlight ? '<span class="tag">Phổ biến</span>' : ''}
          <h3>${escape(offer.name)}</h3>
          ${offer.original_price_vnd ? `<s>${vnd(offer.original_price_vnd)}</s>` : ''}
          <p class="price">${vnd(offer.price_vnd)}</p>
          <p class="plan-hours">${hours(offer.hours)}${Number(offer.bonus_hours) > 0 ? ` <em>+ tặng ${hours(offer.bonus_hours)}</em>` : ''}</p>
          <p class="plan-note">≈ ${vnd(perHour)} / giờ</p>
          ${ends}
        </article>`
      }).join(''))
    }).catch(() => {})
  }
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Frosted nav once the page leaves the top.
  const nav = document.getElementById('nav')
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  }

  // Sections rise in as they enter the view; siblings revealed together are staggered.
  const revealed = document.querySelectorAll('[data-reveal]')
  if ('IntersectionObserver' in window && !calm) {
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
        entry.target.style.setProperty('--delay', `${Math.min(index, 5) * 80}ms`)
        entry.target.classList.add('in')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 })
    revealed.forEach(el => observer.observe(el))
  } else revealed.forEach(el => el.classList.add('in'))

  // The marquee scrolls half its width, so its items are repeated once.
  document.querySelectorAll('[data-marquee] ul').forEach(list => {
    Array.from(list.children).forEach(item => { const copy = item.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); list.append(copy) })
  })

  // Hero demo: a meeting in three languages, transcribed and summarised as it happens.
  const demo = document.querySelector('.demo')
  const lines = demo?.querySelector('[data-demo-lines]'), points = demo?.querySelector('[data-demo-points]')
  if (demo && lines && points) {
    const people = { Sarah: '#2f9e8f', Minh: '#526ade', Linh: '#6253d4' }
    const script = [
      { who: 'Sarah', at: '00:12', text: 'Can we lock the launch date for the mobile app?', vi: 'Mình chốt ngày ra mắt app mobile nhé?' },
      { who: 'Minh', at: '00:31', text: 'Bản beta cần thêm một tuần để sửa lỗi thanh toán.' },
      { point: 'Ý CHÍNH', text: 'Ra mắt app mobile lùi một tuần để sửa lỗi thanh toán.' },
      { who: 'Sarah', at: '00:48', text: 'Marketing can start the campaign on the 20th.', vi: 'Marketing có thể chạy chiến dịch từ ngày 20.' },
      { who: 'Linh', at: '01:05', text: 'Chốt ra mắt ngày 25. Minh gửi bản build trước thứ Sáu nhé.' },
      { point: 'QUYẾT ĐỊNH', text: 'Ra mắt ngày 25/10, chiến dịch marketing bắt đầu từ 20/10.' },
      { task: 'Minh', text: 'Gửi bản build đã sửa lỗi thanh toán', due: 'Hạn: thứ Sáu' },
      { task: 'Sarah', text: 'Chuẩn bị chiến dịch ra mắt', due: 'Hạn: 20/10' },
    ]
    const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node }
    const tick = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>'
    let visible = false
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }).observe(demo)
    const wait = ms => new Promise(resolve => {
      const started = performance.now()
      const step = () => (visible && !document.hidden && performance.now() - started >= ms) ? resolve() : setTimeout(step, 60)
      step()
    })
    const add = async (item, instant) => {
      if (item.who) {
        const line = el('div', 'line'), head = el('div', 'line-head'), who = el('span', 'who', item.who[0]), text = el('div', 'line-text')
        who.style.background = people[item.who]
        head.append(who, el('b', '', item.who), el('span', '', item.at))
        line.append(head, text)
        lines.append(line)
        if (instant) text.textContent = item.text
        else {
          text.classList.add('typing')
          for (let i = 1; i <= item.text.length; i += 2) { text.textContent = item.text.slice(0, i); await wait(28) }
          text.textContent = item.text
          text.classList.remove('typing')
        }
        if (item.vi) line.append(el('div', 'line-vi', `→ ${item.vi}`))
      } else if (item.point) {
        const point = el('div', 'point', item.text)
        point.prepend(el('small', '', item.point))
        points.append(point)
      } else {
        const task = el('div', 'point task'), check = el('span', 'check'), body = el('div')
        check.innerHTML = tick
        body.append(el('b', '', `${item.task} · `), document.createTextNode(item.text), el('em', '', item.due))
        task.append(check, body)
        points.append(task)
      }
    }
    if (calm) script.forEach(item => add(item, true))
    else (async () => {
      for (;;) {
        lines.replaceChildren(); points.replaceChildren()
        demo.classList.remove('fading')
        await wait(500)
        for (const item of script) { await add(item, false); await wait(item.who ? 650 : 900) }
        await wait(4200)
        demo.classList.add('fading')
        await wait(600)
      }
    })()
  }
})()
