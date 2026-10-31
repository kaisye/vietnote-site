// The support form. The app opens it with ?email=…&v=…&os=…, so those come filled in.
(() => {
  const form = document.getElementById('support-form')
  if (!form) return
  const status = form.querySelector('.form-status')
  const submit = form.querySelector('[type="submit"]')
  const dialog = document.getElementById('thank-you')
  const count = form.querySelector('[data-count]')
  const params = new URLSearchParams(location.search)
  const KINDS = { bug: 'Báo lỗi', help: 'Cần hỗ trợ', idea: 'Góp ý' }

  if (params.get('email')) form.email.value = params.get('email').slice(0, 254)
  form.version.value = (params.get('v') || '').slice(0, 40)
  form.os.value = (params.get('os') || '').slice(0, 80)
  if (form.version.value) {
    const meta = form.querySelector('[data-meta]')
    meta.textContent = `Gửi kèm: VietNote ${form.version.value}${form.os.value ? ` · ${form.os.value}` : ''}`
    meta.hidden = false
  }

  const values = () => {
    const data = new FormData(form)
    return Object.fromEntries(['kind', 'message', 'email', 'version', 'os', 'website'].map(name => [name, String(data.get(name) || '').trim()]))
  }

  const validate = () => {
    const data = values()
    const checks = [[form.message, data.message.length >= 5], [form.email, form.email.checkValidity() && data.email]]
    let first = null
    for (const [control, valid] of checks) {
      control.closest('.question-card').classList.toggle('invalid', !valid)
      if (!valid && !first) first = control
    }
    first?.focus()
    return !first
  }

  // Without the server, the person's own email app sends it.
  const emailFallback = data => {
    const body = `${data.message}\n\n—\nLoại: ${KINDS[data.kind]}\nPhiên bản: ${data.version || 'không rõ'}\nHệ điều hành: ${data.os || 'không rõ'}`
    location.href = `mailto:support@vietnote.vn?subject=${encodeURIComponent(`[${KINDS[data.kind]}] ${data.message.split('\n')[0].slice(0, 70)}`)}&body=${encodeURIComponent(body)}`
  }

  form.addEventListener('input', event => {
    event.target.closest('.question-card')?.classList.remove('invalid')
    count.textContent = form.message.value.length
  })

  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!validate()) return
    const data = values()
    submit.disabled = true
    submit.querySelector('span').textContent = 'Đang gửi…'
    status.textContent = ''
    try {
      const response = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      form.message.value = ''
      count.textContent = '0'
      dialog?.showModal()
    } catch {
      status.textContent = 'Chưa gửi được. Chúng tôi mở ứng dụng email để bạn gửi trực tiếp nhé.'
      emailFallback(data)
    } finally {
      submit.disabled = false
      submit.querySelector('span').textContent = 'Gửi'
    }
  })

  dialog?.querySelector('[data-close]')?.addEventListener('click', () => dialog.close())
  dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
})()
