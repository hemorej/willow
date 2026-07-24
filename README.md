# Willow

A small, private journaling app with two secondary self-care tools:

- **Journal** — a daily mood check-in and free-writing entry, with a reverse-chronological log of past entries.
- **BDI-II Inventory** — a Beck Depression Inventory (BDI-II) self-report.
- **CBT Thought Record** — a guided 14-step cognitive-behavioral therapy exercise.

Data is stored in a PostgreSQL database. Access is protected by a login form.

## Stack

- Node.js + Express, serving plain HTML/CSS/JS
- PostgreSQL with JSONB document store (no ORM)
- Session auth via `express-session` + `connect-pg-simple`

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
| `JOURNAL_ENC_KEY` | No | 32-byte AES-256-GCM key, hex-encoded (64 hex chars). If unset, journal entry text is stored in plaintext. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `JOURNAL_ENC_KEY_VERSION` | No | Integer version tag for `JOURNAL_ENC_KEY` (default `1`). Bump when rotating to a new key. |
| `JOURNAL_ENC_KEY_PREV` / `JOURNAL_ENC_KEY_PREV_VERSION` | No | Previous key/version, kept only during a rotation so old rows stay readable until `pnpm run rotate-key` has rewrapped them. |

## Development

```bash
pnpm start    # runs server.js directly, serving from public/
pnpm build    # minify JS/CSS to dist/ for production
```

The server serves `dist/` if it exists, otherwise falls back to `public/` directly.

## How it works

- All routes require an authenticated session. Unauthenticated requests are redirected to `/login`.
- The landing page (`/`) links to both tools.
- The quiz (`/quiz.html`) shows one BDI-II item at a time. Answers are POSTed to `/api/results` on submit.
- The results page (`/results.html`) plots a line chart of scores over time and lists all past results.
- The thought record (`/cbt.html`) walks through 14 steps and saves to `/api/cbt/submit`. Link to `/cbt.html#list` to open the past-entries list directly.

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
├── server.js              # Express server + all API routes
├── db.js                  # pg.Pool singleton
├── migrate.js             # schema creation (runs on startup)
├── scripts/
│   ├── build.js           # esbuild pipeline: minifies JS/CSS, copies statics to dist/
│   ├── create-user.js     # interactive CLI to create/update the login user
│   └── import.js          # one-time import of legacy JSON files into PostgreSQL
├── infra/
│   ├── forge_deploy.sh    # deployment script for Forge hosting
│   ├── nginx.conf         # nginx reverse-proxy config (all traffic → Express)
│   └── supervisord.conf   # process manager config
└── public/
    ├── login.html         # login form
    ├── index.html         # landing page
    ├── quiz.html          # BDI-II questionnaire
    ├── results.html       # past BDI-II results with chart
    ├── cbt.html           # CBT thought record
    ├── questions.js       # BDI-II questions + severity bands
    └── style.css
```

## Deployment (Forge)

Set `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production` in Forge's environment panel. They are passed automatically to the supervised process.

After the first deploy, SSH in and run:

```bash
cd /home/forge/willow.jerome-arfouche.ca/current
DATABASE_URL=... pnpm run create-user
DATABASE_URL=... pnpm run import   # only if migrating from the old file-based store
```
