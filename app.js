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

  const pricing = document.querySelector('[data-pricing]')
  if (pricing && config) {
    fetch(`${config.supabaseUrl}/rest/v1/rpc/credit_offers`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).then(response => response.ok ? response.json() : []).then(offers => {
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
