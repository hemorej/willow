# Willow

[![Laravel Forge Site Deployment Status](https://img.shields.io/endpoint?url=https%3A%2F%2Fforge.laravel.com%2Fsite-badges%2F1901153d-03ce-47d0-8f6d-b34f3990a2d1&style=plastic)](https://forge.laravel.com/jerome-zpm/resilient-bird/3264110)

A small, private journaling app with two secondary self-care tools:

- **Journal** — a daily mood check-in and free-writing entry, with a reverse-chronological log of past entries.
- **BDI-II Inventory** — a Beck Depression Inventory (BDI-II) self-report.
- **CBT Thought Record** — a guided 14-step cognitive-behavioral therapy exercise.

Data is stored in a PostgreSQL database. Access is protected by a login form.

Journal entry text is encrypted at rest (AES-256-GCM) when `JOURNAL_ENC_KEY` is set. An optional daily Web Push reminder can nudge you to write.

## Stack

- Node.js + Express, serving plain HTML/CSS/JS (no client framework, no bundler in dev)
- PostgreSQL with JSONB document store (no ORM)
- Session auth via `express-session` + `connect-pg-simple`
- `routes/` → `controllers/` → `services/` layering; cross-cutting concerns in `middleware/` and `lib/`
- Structured logging via `tslog`; optional Web Push via `web-push`

## Prerequisites

- Node.js 18 or newer
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- PostgreSQL 14 or newer

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create the database
createdb willow

# 3. Copy and fill in the env template
cp .env.template .env
# Edit .env — set DATABASE_URL and SESSION_SECRET at minimum

# 4. Create your login account (tables are created automatically on first run)
DATABASE_URL=postgres://localhost/willow pnpm run create-user

# 5. (Optional) Import any existing JSON result files
DATABASE_URL=postgres://localhost/willow pnpm run import

# 6. Start
pnpm start
```

Then open <http://localhost:3000>.

### Generating a SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes (prod) | Cookie signing secret. Random ephemeral value used if unset (sessions lost on restart). |
| `NODE_ENV` | No | Set to `production` to enable secure (HTTPS-only) session cookies |
| `PORT` | No | HTTP port (default: 3000) |
| `LOG_LEVEL` | No | Minimum app log level (`silly`…`fatal`, default `info`) |
| `JOURNAL_ENC_KEY` | No | 32-byte AES-256-GCM key, hex-encoded (64 hex chars). If unset, journal entry text is stored in plaintext. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `JOURNAL_ENC_KEY_VERSION` | No | Integer version tag for `JOURNAL_ENC_KEY` (default `1`). Bump when rotating to a new key. |
| `JOURNAL_ENC_KEY_PREV` / `JOURNAL_ENC_KEY_PREV_VERSION` | No | Previous key/version, kept only during a rotation so old rows stay readable until `pnpm run rotate-key` has rewrapped them. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | No | Web Push VAPID keypair + `mailto:` contact. All three required to enable the daily push reminder. Generate with `npx web-push generate-vapid-keys`. |
| `REMINDER_TIME` | No | `HH:MM` (24h, server-local) for the daily push reminder. Default `20:00`. Set `TZ` to pin the server timezone. |

## Development

```bash
pnpm start    # runs server.js directly, serving from public/
pnpm build    # minify JS/CSS to dist/ for production
```

The server serves `dist/` if it exists, otherwise falls back to `public/` directly.

## How it works

- All routes require an authenticated session. Unauthenticated page requests are redirected to `/login`; `/api/*` requests get a 401.
- Request handling is layered: `routes/` (paths + per-route middleware) → `controllers/` (validate request, shape response) → `services/` (business logic + SQL). See `CLAUDE.md` for the full map.
- The home page (`/`) is the journal compose surface (mood check-in + free-writing). `/journal.html` is the reverse-chronological log. BDI and CBT are reached from the top-bar nav pills.
- The BDI quiz (`/quiz.html`) shows one item at a time; answers POST to `/api/results`. `/results.html` charts scores over time.
- The thought record (`/cbt.html`) walks through 14 steps and saves to `/api/cbt/submit`. Link to `/cbt.html#list` to open the past-entries list directly.
- If VAPID keys are configured, a toggle in the top bar subscribes the browser to a single daily push reminder (`services/pushService.js`, in-process scheduler — no cron).

## Notes on the inventory

Question 9 of the standard BDI-II (suicidal ideas) is **omitted**, so the inventory has 20 items and a maximum total score of **60** (vs. 63 for the standard form). Severity ranges are scaled accordingly:

| Severity | Score (this app) | Standard BDI-II |
|----------|-----------------|-----------------|
| Minimal  | 0–12            | 0–13            |
| Mild     | 13–18           | 14–19           |
| Moderate | 19–26           | 20–28           |
| Severe   | 27–60           | 29–63           |

This is a self-tracking tool, not a clinical diagnosis. If you are in distress or have thoughts of self-harm, please reach out to a qualified professional or local crisis service.

## File layout

```
willow/
├── package.json
├── pnpm-lock.yaml
├── .env.template          # copy to .env and fill in
├── server.js              # Express app wiring + startup only
├── db.js                  # pg.Pool singleton
├── migrate.js             # schema creation (runs on startup, idempotent)
├── config/env.js          # reads/validates every env var in one place
├── routes/                # one Router per domain, mounted via routes/index.js
├── controllers/           # per-domain request parsing + response shaping (no SQL)
├── services/              # per-domain business logic + pg queries
├── middleware/            # auth gate, CSRF, rate limits, request logging
├── lib/
│   ├── logger.js          # tslog named sub-loggers
│   └── journal-crypto.js  # AES-256-GCM envelope encryption for journal content
├── scripts/
│   ├── build.js                    # esbuild pipeline: minifies JS/CSS, copies statics to dist/
│   ├── create-user.js              # interactive CLI to create/update the login user
│   ├── import.js / import-history.js  # one-time imports of legacy JSON into PostgreSQL
│   ├── rotate-key.js               # rewrap every encrypted row under a new key
│   └── backfill-encrypt-journal.js # encrypt pre-encryption plaintext rows in place
├── infra/
│   ├── forge_deploy.sh    # deployment script for Forge hosting
│   ├── nginx.conf         # nginx reverse-proxy config (all traffic → Express)
│   └── supervisord.conf   # process manager config
└── public/                # plain HTML/CSS/JS — login, index (journal), journal.html,
                           # quiz.html, results.html, cbt.html, shared JS modules, sw.js
```

## Deployment (Forge)

Set `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production` in Forge's environment panel. They are passed automatically to the supervised process.

After the first deploy, SSH in and run:

```bash
cd /home/forge/willow.jerome-arfouche.ca/current
DATABASE_URL=... pnpm run create-user
DATABASE_URL=... pnpm run import   # only if migrating from the old file-based store
```
