// The guide's chapters: each mock app plays its steps in turn, a cursor clicking what the step
// says, while the chapter is on screen. Clicking a step shows it and plays on from there.
//   data-on="2"    shown from step 2 on; "1-2" only in steps 1 and 2; "0-0" only before step 1
//   data-st="3"    gets the class `st` in those steps; "3-3:menu 4:sub" names other classes
//   data-type="…"  typed in as it shows
//   <li data-cursor="name" data-ms="3000"> the step clicks [data-t="name"] first, then holds
(() => {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const WIDTH = 760, HEIGHT = 470

  const icon = path => `<svg class="ic" viewBox="0 0 24 24">${path}</svg>`
  const pages = [
    ['home', 'Trang chủ', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>'],
    ['notes', 'Ghi chú', '<path d="M12 7v14M3 18V4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v14h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'],
    ['translate', 'Phiên dịch', '<path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3"/>'],
    ['watch', 'Xem video', '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M8 21h8M10 7.5v5l4-2.5z"/>'],
    ['file', 'Dịch file · link', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 12v6M12 14v2M15 13v4"/>'],
    ['settings', 'Cài đặt', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'],
  ]

  // The sidebar is the same in every mock: drawn once here, with that chapter's page current.
  document.querySelectorAll('[data-side]').forEach(side => {
    const nav = pages.map(([key, title, path]) => `<div class="a-nav ${key === side.dataset.side ? 'cur' : ''}">${icon(path)}${title}</div>`).join('')
    side.insertAdjacentHTML('afterbegin', `<div class="a-brand"><img src="/assets/logo-v3.svg" alt=""><div><b>VietNote</b><small>MEETING INTELLIGENCE</small></div></div><p class="a-cap">KHÔNG GIAN LÀM VIỆC</p>${nav}`)
    if (!side.querySelector('.a-acct')) side.insertAdjacentHTML('beforeend', '<div class="a-acct"><b>lan.nguyen@gmail.com</b><small><i></i>Còn 10 giờ</small></div>')
  })

  // A QR-looking pattern for the payment step: the three corner squares, the rest scattered.
  document.querySelectorAll('[data-qr]').forEach(svg => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const finder = (x, y) => `<path d="M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`
    const corner = (x, y) => (x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20)
    let cells = ''
    for (let y = 0; y < 29; y++) for (let x = 0; x < 29; x++) if (!corner(x, y) && random() > .52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`
    svg.innerHTML = `<g fill="#131a2e">${finder(0, 0)}${finder(22, 0)}${finder(0, 22)}${cells}</g>`
  })

  // The real packages in the credits mock, as the pricing section shows them.
  const config = window.VIETNOTE
  const plans = document.querySelector('[data-plans]')
  if (config && plans) {
    fetch(`${config.supabaseUrl}/rest/v1/rpc/credit_offers`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).then(response => response.ok ? response.json() : Promise.reject(response.status)).then(offers => {
      if (!Array.isArray(offers) || !offers.length) return
      const shown = offers.slice(0, 3)
      const chosen = shown.find(offer => offer.highlight) ?? shown[Math.floor(shown.length / 2)]
      const vnd = amount => `${new Intl.NumberFormat('vi-VN').format(amount)}đ`
      const hours = value => `${Number(value).toLocaleString('vi-VN')} giờ`
      plans.replaceChildren(...shown.map(offer => {
        const card = document.createElement('div')
        const total = Number(offer.hours) + Number(offer.bonus_hours || 0)
        card.className = `m-plan ${offer === chosen ? 'hl' : ''}`
        if (offer === chosen) card.dataset.t = 'plan'
        card.innerHTML = `${offer.highlight ? '<span class="tag">Phổ biến</span>' : ''}<b></b><strong>${vnd(offer.price_vnd)}</strong><small>${hours(total)}</small>`
        card.querySelector('b').textContent = offer.name
        return card
      }))
      const total = Number(chosen.hours) + Number(chosen.bonus_hours || 0)
      document.querySelectorAll('[data-plan-hours]').forEach(el => { el.textContent = hours(total) })
      document.querySelectorAll('[data-after-hours]').forEach(el => { el.textContent = hours(10 + total) })
    }).catch(() => {})
  }

  const within = (spec, step) => {
    const [from, to] = spec.split('-')
    return step >= Number(from) && (to === undefined || to === '' || step <= Number(to))
  }

  document.querySelectorAll('[data-tut]').forEach(tut => {
    const stage = tut.querySelector('.tut-stage'), app = tut.querySelector('.app')
    const steps = [...tut.querySelectorAll('.tut-steps > li')]
    const cursor = document.createElement('i')
    cursor.className = 'cursor'
    app.append(cursor)

    const fit = () => {
      const scale = stage.clientWidth / WIDTH
      stage.style.setProperty('--s', scale)
      stage.style.height = `${HEIGHT * scale}px`
    }
    fit()
    new ResizeObserver(fit).observe(stage)

    // Typing is cancelled when the step changes under it.
    let typingRun = 0
    const type = async el => {
      const text = el.dataset.type, run = typingRun
      el.classList.add('typing')
      for (let i = 1; i <= text.length; i++) {
        if (run !== typingRun) break
        el.textContent = text.slice(0, i)
        await new Promise(resolve => setTimeout(resolve, 45))
      }
      el.textContent = text
      el.classList.remove('typing')
    }

    const show = step => {
      typingRun++
      tut.querySelectorAll('[data-on]').forEach(el => {
        const on = within(el.dataset.on, step)
        if (on && el.dataset.type && (calm || !el.classList.contains('on'))) calm ? (el.textContent = el.dataset.type) : type(el)
        else if (on && el.dataset.type) el.textContent = el.dataset.type
        el.classList.toggle('on', on)
      })
      tut.querySelectorAll('[data-st]').forEach(el => el.dataset.st.split(' ').forEach(rule => {
        const [spec, name = 'st'] = rule.split(':')
        el.classList.toggle(name, within(spec, step))
      }))
      steps.forEach((li, index) => {
        li.classList.toggle('active', index + 1 === step)
        li.classList.toggle('done', index + 1 < step)
        const button = li.querySelector('button')
        if (index + 1 === step) { button.setAttribute('aria-current', 'step'); li.style.setProperty('--ms', `${li.dataset.ms || 3200}ms`) } else button.removeAttribute('aria-current')
      })
    }

    // The cursor's place is measured on screen, then unscaled into the mock's own pixels.
    const aim = name => {
      const target = app.querySelector(`[data-t="${name}"]`)
      if (!target) return null
      const box = app.getBoundingClientRect(), rect = target.getBoundingClientRect(), scale = box.width / WIDTH
      if (!rect.width) return null
      cursor.style.transform = `translate(${(rect.left - box.left + rect.width / 2) / scale}px, ${(rect.top - box.top + rect.height / 2) / scale}px)`
      cursor.classList.add('show')
      return target
    }
    const press = target => {
      cursor.classList.remove('click'); void cursor.offsetWidth; cursor.classList.add('click')
      target.classList.add('pressed', 'hit')
      setTimeout(() => target.classList.remove('pressed', 'hit'), 260)
    }

    // Time only passes while the chapter is on screen and the tab is open.
    let visible = false, run = 0
    const wait = (ms, id) => new Promise(resolve => {
      let left = ms, last = performance.now()
      const tick = () => {
        if (id !== run) return resolve(false)
        const now = performance.now()
        if (visible && !document.hidden) left -= now - last
        last = now
        if (left <= 0) resolve(true); else setTimeout(tick, 50)
      }
      tick()
    })
    const pace = () => tut.classList.toggle('paused', !visible || document.hidden)

    const play = async (from, id) => {
      for (let step = from; step <= steps.length; step++) {
        const li = steps[step - 1]
        if (li.dataset.cursor) {
          const target = aim(li.dataset.cursor)
          if (!await wait(800, id)) return
          if (target) press(target)
          if (!await wait(150, id)) return
        }
        show(step)
        if (!await wait(Number(li.dataset.ms || 3200), id)) return
      }
      // Fade out, start over from the empty app.
      app.classList.add('resetting')
      if (!await wait(500, id)) return
      show(0)
      cursor.classList.remove('show')
      cursor.style.transform = ''
      app.classList.remove('resetting')
      if (!await wait(1200, id)) return
      play(1, id)
    }

    steps.forEach((li, index) => li.querySelector('button').addEventListener('click', () => {
      const id = ++run
      app.classList.remove('resetting')
      show(index + 1)
      const at = steps[index].dataset.cursor
      if (at) aim(at)
      if (calm) return
      wait(Number(li.dataset.ms || 3200), id).then(going => going && play(index + 2, id))
    }))

    if (calm) { show(steps.length); return }
    show(0)
    let started = false
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      pace()
      if (visible && !started) { started = true; play(1, ++run) }
    }, { threshold: .35 }).observe(stage)
    document.addEventListener('visibilitychange', pace)
  })
})()
