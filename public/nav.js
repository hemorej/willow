// Responsive top-bar menu — on narrow viewports the secondary nav links
// (BDI, CBT) and the reminders toggle collapse behind a kebab button.
// Wires up #nav-more-btn if the page has one; no-op otherwise.
(function () {
  const btn = document.getElementById('nav-more-btn');
  const cluster = btn && btn.closest('.nav-cluster');
  if (!btn || !cluster) return;

  function close() {
    cluster.classList.remove('nav-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = cluster.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (cluster.classList.contains('nav-open') && !cluster.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();
