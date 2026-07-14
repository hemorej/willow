// Appearance (Auto / Light / Dark) — resolves the current theme and wires up
// the top-bar toggle button. Loaded synchronously in <head> so `data-theme`
// is set on <html> before first paint (avoids a flash of the wrong theme).
(function () {
  const STORAGE_KEY = 'willow-appearance';
  const MODES = ['auto', 'light', 'dark'];
  const LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };

  const ICONS = {
    auto: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
    light: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'
  };

  function getMode() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.indexOf(stored) !== -1 ? stored : 'auto';
  }

  function setMode(mode) {
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme();
  }

  function resolveDark(mode) {
    const hour = new Date().getHours();
    return mode === 'dark' || (mode === 'auto' && (hour >= 19 || hour < 6));
  }

  // Milliseconds until the next 6am/7pm boundary, so an open session flips
  // automatically instead of requiring a reload.
  function msUntilNextBoundary() {
    const now = new Date();
    let next = null;
    for (let addDays = 0; addDays < 2 && !next; addDays++) {
      for (const h of [6, 19]) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + addDays);
        candidate.setHours(h, 0, 0, 0);
        if (candidate > now) { next = candidate; break; }
      }
    }
    return next - now;
  }

  let boundaryTimer = null;
  function scheduleNextCheck() {
    clearTimeout(boundaryTimer);
    boundaryTimer = setTimeout(() => {
      applyTheme();
      scheduleNextCheck();
    }, msUntilNextBoundary() + 500);
  }

  function applyTheme() {
    const mode = getMode();
    const dark = resolveDark(mode);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-appearance', mode);
    document.querySelectorAll('.theme-toggle').forEach(renderToggle);
    window.dispatchEvent(new CustomEvent('willow:theme-change', { detail: { mode, dark } }));
  }

  function renderToggle(btn) {
    const mode = getMode();
    btn.innerHTML = ICONS[mode];
    btn.title = `Appearance: ${LABELS[mode]} (click to change)`;
  }

  function onToggleClick(e) {
    const mode = getMode();
    setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  }

  function initToggles() {
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      renderToggle(btn);
      btn.addEventListener('click', onToggleClick);
    });
  }

  // Resolve + apply before first paint.
  applyTheme();
  scheduleNextCheck();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applyTheme();
  });
  window.addEventListener('focus', applyTheme);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggles);
  } else {
    initToggles();
  }

  window.WillowTheme = { getMode, setMode, applyTheme };
})();
