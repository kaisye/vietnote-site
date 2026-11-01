// Filters the timeline by tag (?tag=... keeps the choice in the link) and flips its order.
(() => {
  const buttons = document.querySelectorAll('.blog-filter button')
  const timeline = document.querySelector('.timeline')
  const show = tag => {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tag === tag)))
    timeline.querySelectorAll('.tl-month').forEach(month => {
      const posts = month.querySelectorAll('.tl-item')
      posts.forEach(p => { p.hidden = tag !== '' && p.dataset.tag !== tag })
      month.hidden = [...posts].every(p => p.hidden)
    })
  }
  buttons.forEach(b => b.addEventListener('click', () => {
    show(b.dataset.tag)
    const url = new URL(location.href)
    if (b.dataset.tag) url.searchParams.set('tag', b.dataset.tag)
    else url.searchParams.delete('tag')
    history.replaceState(null, '', url)
  }))
  const wanted = new URLSearchParams(location.search).get('tag') || ''
  if ([...buttons].some(b => b.dataset.tag === wanted)) show(wanted)

  const sort = document.querySelector('.blog-sort')
  sort.addEventListener('click', () => {
    const oldest = sort.dataset.oldest !== 'true'
    timeline.querySelectorAll('.post-list').forEach(list => list.append(...[...list.children].reverse()))
    timeline.append(...[...timeline.querySelectorAll('.tl-month')].reverse())
    sort.dataset.oldest = String(oldest)
    sort.textContent = oldest ? 'Xem mới nhất trước ↑' : 'Xem từ ngày đầu tiên ↓'
  })
})()
