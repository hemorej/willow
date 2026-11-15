// Sentry init. Must be required before express/http so the SDK can hook them.
// Deliberately minimal: this app stores journal and mental-health check-in data,
// so only error events are sent — no tracing, no log forwarding, and none of the
// request context (cookies, headers, bodies, query strings, user info) that
// Sentry v11 would otherwise collect by default. No SENTRY_DSN ⇒ SDK stays off.

const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    // Console output can echo user-entered content; keep it out of breadcrumbs.
    beforeBreadcrumb: (crumb) => (crumb.category === 'console' ? null : crumb)
  });
}
