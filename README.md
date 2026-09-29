# VELI

Pre-launch waitlist site for VELI, an AI safety companion that clips to your bag.

## How it runs

- Static HTML, CSS and JS. No build step.
- Served by a Cloudflare Worker with static assets (`worker.js`).
- Deployed by GitHub Actions on every push to `main` (`.github/workflows/deploy-cloudflare.yml`).
  The workflow writes `wrangler.toml`, makes sure the D1 database exists, applies `schema.sql`,
  adds any new columns to the existing table and deploys.

## Waitlist

Signups are stored in Cloudflare D1 (`veli-waitlist`, binding `WAITLIST_DB`, table `waitlist`):
email, optional answer, timestamp, referrer, UTM source and country.

| Endpoint | What it does |
| --- | --- |
| `POST /api/waitlist` | Adds a signup. Honeypot field `website`, max 5 attempts per IP per 10 minutes. |
| `GET /api/waitlist/count` | Returns the real count, or `null` until it passes 100. |
| `GET /api/admin/export` | CSV of all signups. Needs the admin token. Add `format=json` for JSON. |

### Admin export

1. Add a GitHub Actions secret called `VELI_ADMIN_TOKEN` with a long random value.
   The deploy copies it into the Worker as `ADMIN_TOKEN`. Until it is set, the export returns 404.
2. Download the CSV:

```sh
curl -H "Authorization: Bearer YOUR_TOKEN" https://meetveli.dannythehat2.workers.dev/api/admin/export -o veli-waitlist.csv
```

Opening `https://meetveli.dannythehat2.workers.dev/api/admin/export?token=YOUR_TOKEN` in a browser also works.

## Analytics

Cloudflare Web Analytics. Paste the site token into `window.VELI_CF_ANALYTICS_TOKEN` in `index.html`.
Each new signup is recorded as a page view of `/joined`.

## Images and video

- The page uses compressed WebP copies in `assets/web/`. The large PNG originals stay in `assets/`
  but are excluded from the deploy by `.assetsignore`.
- Drop the demo video at `assets/video/veli-demo.mp4`. See `assets/video/README.md`.
- All product imagery is concept artwork created for VELI.

## Local development

```sh
npx wrangler d1 execute veli-waitlist --local --file=schema.sql
npx wrangler dev
```

This needs a local `wrangler.toml` (git-ignored) matching the one the deploy workflow writes,
and `ADMIN_TOKEN=...` in `.dev.vars` to try the export.
