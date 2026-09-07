// Daily reminder toggle — subscribes/unsubscribes this browser to Web Push.
// Wires up a single button (#push-toggle) if the page has one; no-op otherwise.
(function () {
  const SUPPORTED = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64Safe);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  let csrfToken = null;
  async function getCsrfToken() {
    if (!csrfToken) {
      const r = await fetch('/api/csrf-token');
      csrfToken = (await r.json()).csrfToken;
    }
    return csrfToken;
  }

  async function postJson(url, body) {
    const token = await getCsrfToken();
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify(body || {})
    });
  }

  function setButtonState(button, subscribed) {
    button.setAttribute('aria-pressed', String(subscribed));
    button.classList.toggle('is-active', subscribed);
    button.title = subscribed ? 'Disable daily reminders' : 'Enable daily reminders';
    button.querySelector('.push-toggle-label').textContent = subscribed ? 'Reminders on' : 'Reminders off';
  }

  async function subscribe(button) {
    const keyRes = await fetch('/api/push/public-key');
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const res = await postJson('/api/push/subscribe', subscription.toJSON());
    if (res.ok) setButtonState(button, true);
  }

  async function unsubscribe(button) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await postJson('/api/push/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    setButtonState(button, false);
  }

  async function init() {
    const button = document.getElementById('push-toggle');
    if (!button || !SUPPORTED) {
      if (button) button.hidden = true;
      return;
    }

    // Reveal the toggle as soon as we know the browser supports Web Push.
    // Don't gate visibility on service-worker registration succeeding — it
    // can be slow, or disabled outright in browser dev tooling, and the
    // button still needs to show (and collapse into the mobile nav menu).
    button.hidden = false;

    try {
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setButtonState(button, !!existing && Notification.permission === 'granted');
    } catch (err) {
      // Leave the button in its default "off" state; a real failure will
      // surface when the user actually tries to enable reminders.
      console.warn('push: could not check existing subscription', err);
    }

    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        // Must be the first await in this handler — Firefox only shows the
        // native permission dialog when requestPermission() is called as a
        // direct, uninterrupted response to the click (a "user gesture").
        // Any await before it (e.g. checking for an existing subscription
        // first) silently loses that gesture and the call just no-ops.
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }

        await navigator.serviceWorker.register('/sw.js');
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribe(button);
        } else {
          await subscribe(button);
        }
      } finally {
        button.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
