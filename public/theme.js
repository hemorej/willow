// Appearance (Light / Dark) — resolves the current theme and wires up the
// top-bar toggle button. Loaded synchronously in <head> so `data-theme` is
// set on <html> before first paint (avoids a flash of the wrong theme).
(function () {
  const STORAGE_KEY = 'willow-appearance';
  const MODES = ['light', 'dark'];
  const LABELS = { light: 'Light', dark: 'Dark' };

  const ICONS = {
    light: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'
  };

  function getMode() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.indexOf(stored) !== -1 ? stored : 'light';
  }

  function setMode(mode) {
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme();
  }

  function applyTheme() {
    const mode = getMode();
    document.documentElement.setAttribute('data-theme', mode);
    document.querySelectorAll('.theme-toggle').forEach(renderToggle);
    window.dispatchEvent(new CustomEvent('willow:theme-change', { detail: { mode, dark: mode === 'dark' } }));
  }

  function renderToggle(btn) {
    const mode = getMode();
    const next = mode === 'dark' ? 'light' : 'dark';
    btn.innerHTML = ICONS[mode];
    btn.title = `Appearance: ${LABELS[mode]} (click for ${LABELS[next]})`;
  }

  function onToggleClick() {
    setMode(getMode() === 'dark' ? 'light' : 'dark');
  }

  function initToggles() {
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      renderToggle(btn);
      btn.addEventListener('click', onToggleClick);
    });
  }

  // Resolve + apply before first paint.
  applyTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggles);
  } else {
    initToggles();
  }

  window.WillowTheme = { getMode, setMode, applyTheme };
})();
