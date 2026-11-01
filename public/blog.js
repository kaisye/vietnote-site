// Filters the blog list by tag; ?tag=... keeps the choice in the link.
(() => {
  const buttons = document.querySelectorAll('.blog-filter button')
  const posts = document.querySelectorAll('.post-list li')
  const show = tag => {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tag === tag)))
    posts.forEach(p => { p.hidden = tag !== '' && p.dataset.tag !== tag })
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
})()
