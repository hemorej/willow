// Appearance (Light / Dark) — resolves the current theme automatically.
// Loaded synchronously in <head> so `data-theme` is set on <html> before
// first paint (avoids a flash of the wrong theme). Prefers the OS/browser
// `prefers-color-scheme` setting; falls back to a 7pm–6am local-time
// heuristic when that media feature isn't supported.
(function () {
  const query = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  const supportsMediaQuery = !!(query && typeof query.media === 'string' && query.media !== 'not all');

  function isNightByClock() {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 6;
  }

  function getMode() {
    if (supportsMediaQuery) return query.matches ? 'dark' : 'light';
    return isNightByClock() ? 'dark' : 'light';
  }

  function applyTheme() {
    const mode = getMode();
    document.documentElement.setAttribute('data-theme', mode);
    window.dispatchEvent(new CustomEvent('willow:theme-change', { detail: { mode, dark: mode === 'dark' } }));
  }

  applyTheme();

  if (supportsMediaQuery) {
    const onChange = () => applyTheme();
    if (query.addEventListener) query.addEventListener('change', onChange);
    else if (query.addListener) query.addListener(onChange);
  } else {
    setInterval(applyTheme, 60 * 1000);
  }

  window.WillowTheme = { getMode, applyTheme };
})();
