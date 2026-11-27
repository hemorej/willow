---
applyTo: "**"
excludeAgent: "cloud-agent"
---

# Code review instructions

Willow is a private, single-user journaling and mental health app: Node and Express (CommonJS), PostgreSQL through `pg` with no ORM, and plain HTML, CSS and JavaScript in `public/`. It holds highly sensitive data. Merging to `main` deploys to production with no test gate and there are no automated tests, so read behaviour changes carefully.

## What to review

In priority order:

1. Security vulnerabilities and data loss.
2. Correctness: bugs, unhandled edge cases, race conditions.
3. Regressions: changed behaviour of existing callers, API shapes or stored data.
4. Performance: repeated or unbounded work, queries, requests or memory use.
5. Documentation that no longer matches the code.
6. Readability that is likely to cause a future mistake.

## What to report

- Report an issue only if you can name the input or sequence of events that triggers it and the resulting wrong behaviour. For documentation, quote the statement and name the code that contradicts it.
- If an issue depends on something you could not verify, say what you assumed.
- State the impact and suggest a concrete fix.
- Skip formatting, naming preferences, style that doesn't hurt readability, and speculative refactors.
- Don't report problems in code the pull request doesn't touch or affect.
- Finding nothing is an acceptable result.

## Documentation alignment

For every behaviour change, check the code comments and `README.md`, `infra/README.md`, `.env.template` and `infra/env.example`. Flag:

- Comments or docs that now describe old behaviour, including in unchanged lines.
- Renamed or removed files, routes, scripts, settings or environment variables still referenced by their old name.
- New environment variables, routes, scripts or scheduled work that are undocumented.
- Changes to `infra/` files that need a matching manual step which the docs don't mention.

Don't ask for comments on self-explanatory code.

## Project rules

Security and privacy:

- Everything needs an authenticated session except the allow-listed login routes and assets. Question any addition to `PUBLIC_PATHS`.
- Every route that changes data uses `validateCsrf`.
- SQL uses parameterised queries.
- Escape user text before inserting it into the DOM.
- Never log or send to Sentry journal text, answers, check-in results, credentials, tokens or request objects.
- Journal bodies, journal JSON data and follow-up answers are encrypted before every write and decrypted after every read. Legacy plaintext must still read correctly, and key rotation must stay resumable.
- Push subscription endpoints are checked against the allowed vendor hosts before they are stored.

Data correctness:

- `migrate.js` runs on every startup. Schema changes must be safe to re-run on existing production data.
- Journal dates are the user's local date sent by the client, not server time.
- Check-in answers are keyed by question id, and item order is shuffled. Scoring must not depend on display order.
- The self-harm item stays last and a non-zero answer shows the crisis resources note.
- Results from the two check-in instruments are never mixed or converted.
- Reminder schedulers run in process. Check timezone and daylight saving handling.

Operations and conventions:

- Requests go through `routes/`, then `controllers/`, then `services/`. SQL stays in services.
- Values duplicated between `public/` and `services/` (such as gratitude tags) must stay in sync.
- `sw.js` is served from the root, and hashed asset names must still work before login.
- Use pnpm. Fonts are self-hosted.
