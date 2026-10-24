# infra — willow.jerome-arfouche.ca

Production runs on the shared DigitalOcean droplet described in
`~/Code/util/infra/` (OS, nginx globals, backups, restore). This directory is
everything specific to this app. Facts as of 2026-10-23.

## Where it lives

| | |
|---|---|
| Domain | `willow.jerome-arfouche.ca` (port 80 → https; `www.` handled by Forge) |
| Stack | Express (`node server.js`) behind nginx; frontend built with `pnpm build`; PostgreSQL |
| Process | supervisor program `daemon-910985`, `user=forge`, **port 9090**, log `/home/forge/.forge/daemon-910985.log` |
| Site root | `/home/forge/willow.jerome-arfouche.ca/current/` → `releases/<id>/`, 4 releases kept (Forge setting); nginx proxies everything to `localhost:9090` |
| Forge site id | `3264110` |
| Database | local Postgres; role `bdi2user`, database `bdi2db` (the app's former name) |
| Schedulers | in-process, no cron: the daily push reminder (`REMINDER_TIME`, default 20:00) and the Thursday check-in nudge (`CHECKIN_REMINDER_TIME`, default 09:00), both in **server-local time** — set `TZ` in `.env` to pin it |
| TLS | Let's Encrypt via Forge, renewed Wed 20:39 (`/root/.letsencrypt-renew/3611246`) |

## Files here

| File | Purpose | Applied how |
|---|---|---|
| `forge_deploy.sh` | The deploy script — identical to what's in Forge's *Deploy Script* box (keep them in step by hand; it isn't on the server, so `snapshot.sh` can't check it) | Forge UI |
| `nginx.conf` | The vhost (`/etc/nginx/sites-available/willow.jerome-arfouche.ca`) | By hand; `./snapshot.sh` flags drift |
| `supervisord.conf` | The Express daemon (`/etc/supervisor/conf.d/daemon-910985.conf`) | Created by Forge's *Daemons* page; `./snapshot.sh` flags drift |
| `postgres.sql` | One-time role/database grants (run as `postgres`; set the password) | By hand |
| `forge-conf/` | Forge-generated includes, read-only reference (see below) | Refreshed by `./snapshot.sh` |
| `env.example` | Names of the variables in the server-side `.env` | — |
| `manifest`, `snapshot.sh` | What to compare with the server, and the script | `./snapshot.sh` |

## Server layout

```
/home/forge/willow.jerome-arfouche.ca/
  .env                       sourced by the supervisor program (`set -a; source .env`) — see env.example
  current -> releases/<id>
  releases/<id>/
    .env -> ../../.env
    public/fonts -> /mnt//data-volume/willowfonts     (double slash: VOLUME_NAME has a leading "/")
```

Schema creation runs on every start (`migrate.js`, idempotent), so there's no migrate step in the deploy.
Changing a variable in `.env` needs `sudo supervisorctl restart daemon-910985:daemon-910985_00`.

**Back up `.env` out of band.** The journal is encrypted with `JOURNAL_ENC_KEY` (and `…_PREV` during rotation);
a Postgres restore without those keys leaves the journal unreadable. The droplet backups contain `.env`, but
nothing else does.

## Deploy

1. Push to `main` → `.github/workflows/deploy.yml` (environment `production`, no CI gate) calls the Forge
   deploy-trigger URL (secret `FORGE_DEPLOY_URL`), then polls the Forge API (`FORGE_API_TOKEN`, org/server/site ids)
   until the deployment is `finished` or fails.
2. `forge_deploy.sh`: `$CREATE_RELEASE()`, strip the token from the remote URL, `pnpm install --frozen-lockfile`,
   link the fonts, `pnpm build`, `$ACTIVATE_RELEASE()`, `sudo supervisorctl restart daemon-910985:daemon-910985_00`.

`forge` may run `supervisorctl restart|start|stop|status|update` without a password (`util/infra/droplet.md`).

## nginx

`nginx.conf` proxies `/` to `localhost:9090` (the Express app owns the auth gate), blocks `*.map`, and keeps two
app-specific scanner rules local (`/js/`, `/assets/js/`, `/static/` and `secrets.json`-style probes → 444).
Shared pieces come from `~/Code/util/infra/nginx/` (`snippets/bot-mitigation.conf`, the `willow_api` zone —
commented out). `forge-conf/` holds `site.conf` (TLS settings, headers, the `.`-file deny rule, error log
`/var/log/nginx/3264110-error.log`), `before/redirect.conf` / `before/ssl_redirect.conf`, and
`server/redirect_rules.conf`, which carries a leftover Forge rule from the app's old name
(`rewrite bdi2.jerome-arfouche.ca jerome-arfouche.ca/bdi2 permanent`). It matches against the request *path*, not
the host, so it never fires; it's safe to delete in Forge.

## Leaving Forge — what needs a new owner

- **The Forge macros** `$CREATE_RELEASE()` / `$ACTIVATE_RELEASE()`: clone, `current` swap, pruning to 4 releases,
  the `.env` link.
- **Deploy trigger and status** — SSH as `forge` replaces the curl + API polling in `deploy.yml`.
- **vhost includes** — inline `forge-conf/3264110/site.conf` and the redirects, drop the `# FORGE …` lines.
- **The daemon** — `supervisord.conf` is an ordinary supervisor program and stays as is.
- **TLS** — Forge-managed `ssl_certificate` paths (`/etc/nginx/ssl/domains/1818825/<cert-id>/`), rewritten on every
  renewal; keep `/.well-known/acme-challenge/` served from `/home/forge/.letsencrypt/`.
