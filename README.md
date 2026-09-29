# VELI

Pre-launch site for VELI, an AI safety companion that clips to your bag.
The main call to action is the 60 Second Safety Check at `/check`.

## How it runs

- Static HTML, CSS and JS. No build step.
- Served by a Cloudflare Worker with static assets (`worker.js`, with API code in `server/`).
- Deployed by GitHub Actions on every push to `main` (`.github/workflows/deploy-cloudflare.yml`).
  The workflow writes `wrangler.toml`, makes sure the D1 database exists, applies `schema.sql`,
  adds any new columns to existing tables, deploys and syncs secrets.

## Settings

All in the `env:` block at the top of `.github/workflows/deploy-cloudflare.yml`:

| Setting | What it does |
| --- | --- |
| `SITE_URL` | Public address used in canonical, Open Graph and Twitter tags, the sitemap and email links. Empty means "the address the visitor used". |
| `EMAIL_FROM` | Sender for plan emails, for example `VELI <hello@meetveli.com>`. Must be on a domain verified in Resend. |
| `EMAIL_REPLY_TO` | Where replies and unsubscribe requests go. |

GitHub Actions secrets:

| Secret | What it does |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deploys the Worker and manages D1. |
| `VELI_ADMIN_TOKEN` | Unlocks `/admin` and the CSV exports. Without it they return 404. |
| `RESEND_API_KEY` | Turns on plan emails. Without it the plan is shown on screen only. |

Pages use `__SITE_URL__` in their meta tags. The Worker fills it in when it serves the page.
The Cloudflare Web Analytics token goes in `config.js`.

## Safety check

- `plan.js` holds the questions, tags, concern copy and safety tips. The browser and the Worker both use it.
- Progress is saved after every answer to D1 table `quiz_sessions`, so partial runs show drop off.
- Email signups from the result page also go into the `waitlist` table with source `safety check`.
- Analytics events are virtual page views, because Cloudflare Web Analytics has no custom events:
  `/check/quiz_start`, `/check/q1_answered` to `/check/q9_answered`, `/check/quiz_complete`, `/check/email_signup`.
  Signups from the home page form show as `/joined`.

## Admin

- Summary: `/admin` (asks for the token, or open `/admin?token=YOUR_TOKEN`).
- Safety check CSV: `/api/admin/quiz-export?token=YOUR_TOKEN`
- Waitlist CSV: `/api/admin/export?token=YOUR_TOKEN` (add `&format=json` for JSON)

```sh
curl -H "Authorization: Bearer YOUR_TOKEN" https://YOUR_SITE/api/admin/quiz-export -o veli-safety-check.csv
```

## Images and video

- Pages use compressed WebP copies in `assets/web/`. The PNG originals stay in `assets/`
  but are excluded from the deploy by `.assetsignore`.
- Drop the demo video at `assets/video/veli-demo.mp4`. See `assets/video/README.md`.
- All product imagery is concept artwork created for VELI.

## Local development

Create a git-ignored `wrangler.toml` matching the one the workflow writes, then:

```sh
npx wrangler d1 execute veli-waitlist --local --file=schema.sql
npx wrangler dev
```

Put `ADMIN_TOKEN=...` in `.dev.vars` to try the admin pages.
