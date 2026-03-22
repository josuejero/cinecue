# CineCue

CineCue is a followed-movies and local-availability change engine.

It uses:

- Gracenote as the source of truth for theatrical availability, theatres, showtimes, and future releases
- TMDB for movie enrichment such as posters, artwork, and metadata
- a Next.js app plus worker for search, follows, notifications, dashboard reads, and ops

## Stack

- Next.js App Router
- TypeScript
- Auth.js / `next-auth@5` beta
- PostgreSQL + PostGIS
- Drizzle ORM
- Redis + BullMQ
- Nodemailer
- Web Push + service worker
- Vitest

## Prerequisites

- Node 22.x
- Docker
- a real Gracenote API key
- a TMDB read token or API key
- optional SMTP credentials for email notifications
- optional GitHub OAuth credentials for sign-in
- optional VAPID keys for browser push

## Local bootstrap

Start local infrastructure:

```bash
docker compose up -d
```

Install dependencies:

```bash
npm install
```

Create the env file:

```bash
cp .env.example .env
```

Generate VAPID keys for push, then paste them into `.env`:

```bash
npm run vapid:generate
```

Apply database migrations:

```bash
npm run db:migrate
```

Run validation:

```bash
npm run smoke
```

Run the worker:

```bash
npm run worker
```

In another terminal, run the app:

```bash
npm run dev
```

## Core scripts

### Phase 1 sync by ZIP

```bash
npm run phase1:sync -- --zip 10001 --start-date 2026-03-22 --num-days 14 --radius-miles 25 --country USA
```

### Rebuild read models

```bash
npm run phase2:rebuild -- --zip 10001
```

### Email notification dry run

```bash
npm run phase3:notify -- --dry-run --limit 50 --days-back 14
```

### Scheduler bootstrap

```bash
npm run phase4:schedulers
```

### Enqueue active-location syncs

```bash
npm run phase4:sync-active -- --limit 100
```

### Replay one location

```bash
npm run phase4:replay-location -- --location-id YOUR_LOCATION_ID --start-date 2026-03-22 --num-days 7
```

### Replay one movie in one location

```bash
npm run phase4:replay-movie -- --location-id YOUR_LOCATION_ID --movie-id YOUR_MOVIE_ID
```

### Push notification dry run

```bash
npm run phase5:push -- --dry-run --limit 50 --days-back 7
```

### Phase 6 ops snapshot

```bash
npm run phase6:ops-report
```

## Readiness and health

```bash
curl -s http://localhost:3000/api/ready
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/ops
curl -s http://localhost:3000/api/ops/phase6
```

## Environment notes

- `GRACENOTE_API_KEY` must be replaced with a real key. The provider client checks whether your `.env` value still matches the placeholder from `.env.example`, and Phase 1 syncs fail fast if it does.
- `AUTH_SECRET` must be at least 32 characters.
- Push requires HTTPS in production or `localhost` in development.
- SMTP is optional for booting the app, but required for real email delivery.
- `GRACENOTE_MEDIA_CLOUD_BASE_URL` defaults to `https://developer.tmsimg.com` and is used to resolve relative poster paths.

## Troubleshooting

### Gracenote theatre sync returns 403

If the dedicated theatre sync returns `403 Not Authorized` but showings and future releases still work, that usually means the credential does not have access to that specific endpoint. The codebase already degrades by skipping the dedicated theatre sync and continuing with showings and future releases so the rest of the pipeline can still work. Fix the entitlement with Gracenote, then replay the affected location.

### `next build` fails with `NODE_ENV=development`

Do not force `NODE_ENV=development` during builds. Next sets production mode for builds automatically, and this repo already normalizes that in `next.config.ts`.

### Browser push does not work locally

Use `localhost`, generate VAPID keys, and confirm the service worker is registered. Push will not work on plain non-local HTTP.

## Production notes

- Run the web app and worker as separate long-lived processes.
- Keep Postgres and Redis managed or strongly monitored.
- Keep raw provider payload retention, replay tools, and ops endpoints enabled.
- Keep `next-auth` pinned exactly until you intentionally retest auth flows.
