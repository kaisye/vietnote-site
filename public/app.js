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

  // Light by default; the toggle remembers dark for this browser.
  const toggle = document.getElementById('theme-toggle')
  if (toggle) toggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark'
    if (dark) document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0e0b22' : '#f6f5fb'
    try { localStorage.setItem('vietnote.theme', dark ? 'dark' : 'light') } catch {}
  })

  // Downloading for macOS: the installer keeps downloading while the install video plays.
  const guide = document.getElementById('mac-guide')
  if (guide && typeof guide.showModal === 'function') {
    const video = guide.querySelector('video')
    document.querySelectorAll('[data-downloads] [data-os="mac"]').forEach(link => link.addEventListener('click', () => {
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
  }

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
})()
