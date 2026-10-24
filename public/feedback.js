(() => {
  const form = document.getElementById('feedback-form')
  if (!form) return

  const storageKey = 'vietnote.feedback.draft.v1'
  const requiredCards = [...form.querySelectorAll('[data-required]')]
  const questionCards = [...form.querySelectorAll('[data-question]')]
  const progressText = document.querySelector('[data-progress-text]')
  const progressBar = document.querySelector('[data-progress-bar]')
  const status = form.querySelector('.form-status')
  const submit = form.querySelector('[type="submit"]')
  const dialog = document.getElementById('thank-you')
  const otherChoice = form.querySelector('[name="use_case"][value="Khác"]')
  const otherInput = form.querySelector('[name="use_case_other"]')

  const values = () => {
    const data = new FormData(form)
    return {
      rating: data.get('rating') || '',
      use_case: data.getAll('use_case'),
      use_case_other: otherChoice.checked ? String(data.get('use_case_other') || '').trim() : '',
      occupation: data.get('occupation') || '',
      most_useful: String(data.get('most_useful') || '').trim(),
      friction: String(data.get('friction') || '').trim(),
      feature_request: String(data.get('feature_request') || '').trim(),
      nps: data.get('nps') || '',
      email: String(data.get('email') || '').trim(),
      website: String(data.get('website') || ''),
    }
  }

  const cardAnswered = card => {
    const controls = [...card.querySelectorAll('input, textarea')]
    return controls.some(control => control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value.trim() && control.checkValidity())
  }

  const updateProgress = () => {
    const answered = questionCards.filter(cardAnswered).length
    const percent = Math.round(answered / questionCards.length * 100)
    progressText.textContent = percent
    progressBar.style.width = `${percent}%`
  }

  const saveDraft = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(values())) } catch {}
  }

  const restoreDraft = () => {
    let draft
    try { draft = JSON.parse(localStorage.getItem(storageKey)) } catch {}
    if (!draft) return
    for (const [name, value] of Object.entries(draft)) {
      if (name === 'website') continue
      const controls = [...form.elements].filter(control => control.name === name)
      controls.forEach(control => {
        if (control.type === 'checkbox') control.checked = Array.isArray(value) ? value.includes(control.value) : Boolean(value)
        else if (control.type === 'radio') control.checked = control.value === value
        else control.value = value
      })
    }
  }

  // "Mục đích khác" opens a field to say what it is.
  const showOther = focus => {
    otherInput.hidden = !otherChoice.checked
    if (focus && otherChoice.checked) otherInput.focus()
  }

  // Quick tags add or remove their phrase in the answer; the email one fills in the domain.
  const tagLists = [...form.querySelectorAll('.quick-tags')]
  const fieldOf = list => form.elements[list.dataset.for]
  const parts = value => value.split(/\s*[;\n]\s*/).filter(Boolean)
  const markTags = () => tagLists.forEach(list => {
    if (list.hasAttribute('data-domain')) return
    const chosen = parts(fieldOf(list).value)
    list.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', chosen.includes(button.textContent)))
  })
  form.addEventListener('click', event => {
    const button = event.target.closest('.quick-tags button')
    if (!button) return
    const list = button.parentElement, field = fieldOf(list), tag = button.textContent
    if (list.hasAttribute('data-domain')) field.value = field.value.trim().replace(/@.*$/, '') + tag
    else {
      const current = parts(field.value)
      field.value = (current.includes(tag) ? current.filter(part => part !== tag) : [...current, tag]).join('; ').slice(0, field.maxLength)
    }
    field.dispatchEvent(new Event('input', { bubbles: true }))
    if (list.hasAttribute('data-domain')) field.focus()
  })

  const updateCounts = () => form.querySelectorAll('textarea').forEach(area => {
    const counter = form.querySelector(`[data-count-for="${area.name}"]`)
    if (counter) counter.textContent = area.value.length
  })

  const validate = () => {
    let firstInvalid
    requiredCards.forEach(card => {
      const valid = cardAnswered(card)
      card.classList.toggle('invalid', !valid)
      if (!valid && !firstInvalid) firstInvalid = card
    })
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
      firstInvalid.querySelector('input, textarea')?.focus({ preventScroll: true })
      status.textContent = 'Còn một vài câu bắt buộc cần bạn trả lời.'
      return false
    }
    status.textContent = ''
    return true
  }

  const emailFallback = data => {
    const lines = [
      `Đánh giá tổng thể: ${data.rating}/5`,
      `Mục đích sử dụng: ${data.use_case.join(', ') || 'Không trả lời'}${data.use_case_other ? ` (${data.use_case_other})` : ''}`,
      `Nghề nghiệp / vai trò: ${data.occupation || 'Không trả lời'}`,
      '', `Hữu ích nhất: ${data.most_useful}`,
      '', `Điểm chưa hài lòng: ${data.friction || 'Không trả lời'}`,
      '', `Tính năng mong muốn: ${data.feature_request || 'Không trả lời'}`,
      '', `Khả năng giới thiệu: ${data.nps}/10`,
      `Email: ${data.email}`,
    ]
    window.location.href = `mailto:support@vietnote.vn?subject=${encodeURIComponent('Góp ý từ người dùng VietNote')}&body=${encodeURIComponent(lines.join('\n'))}`
  }

  form.addEventListener('input', event => {
    event.target.closest('.question-card')?.classList.remove('invalid')
    markTags()
    updateCounts()
    updateProgress()
    saveDraft()
  })
  form.addEventListener('change', event => { if (event.target === otherChoice) showOther(true); updateProgress(); saveDraft() })

  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!validate()) return
    const data = values()
    const endpoint = window.VIETNOTE?.feedbackEndpoint
    submit.disabled = true
    submit.querySelector('span').textContent = endpoint ? 'Đang gửi…' : 'Đang mở email…'
    try {
      if (endpoint) {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        try { localStorage.removeItem(storageKey) } catch {}
        form.reset(); showOther(); markTags(); updateCounts(); updateProgress()
        dialog?.showModal()
      } else {
        emailFallback(data)
        status.textContent = 'Ứng dụng email đã được mở. Bạn chỉ cần kiểm tra lại và nhấn Gửi.'
      }
    } catch {
      status.textContent = 'Chưa gửi được góp ý. Chúng tôi sẽ mở email để bạn gửi trực tiếp nhé.'
      emailFallback(data)
    } finally {
      submit.disabled = false
      submit.querySelector('span').textContent = 'Gửi góp ý'
    }
  })

  dialog?.querySelector('[data-close]')?.addEventListener('click', () => dialog.close())
  dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  restoreDraft()
  showOther()
  markTags()
  updateCounts()
  updateProgress()
})()
