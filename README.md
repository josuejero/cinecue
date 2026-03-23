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

### Sync availability by ZIP

```bash
npm run availability:sync -- --zip 10001 --start-date 2026-03-22 --num-days 14 --radius-miles 25 --country USA
```

### Rebuild read models

```bash
npm run availability:rebuild-read-model -- --zip 10001
```

### Email notification dry run

```bash
npm run notifications:send-email -- --dry-run --limit 50 --days-back 14
```

### Scheduler bootstrap

```bash
npm run worker:schedulers
```

### Enqueue active-location syncs

```bash
npm run availability:sync-active -- --limit 100
```

### Replay one location

```bash
npm run availability:replay-location -- --location-id YOUR_LOCATION_ID --start-date 2026-03-22 --num-days 7
```

### Replay one movie in one location

```bash
npm run availability:replay-movie -- --location-id YOUR_LOCATION_ID --movie-id YOUR_MOVIE_ID
```

### Push notification dry run

```bash
npm run notifications:send-push -- --dry-run --limit 50 --days-back 7
```

### Operations snapshot

```bash
npm run ops:report
```

## Runtime id cutover

Use this once when cutting over from the historical runtime ids to the domain-named queues, schedulers, and dashboard cache keys.

Preview the cutover:

```bash
npm run ops:cutover-runtime-ids -- --dry-run
```

Maintenance runbook:

1. Stop the web app and worker so no old jobs are still being produced or consumed.
2. Deploy the code and env changes that use the new runtime ids.
3. Run `npm run ops:cutover-runtime-ids` to remove legacy schedulers, clear legacy dashboard cache keys, bootstrap the new schedulers, and enqueue fresh availability, email, and push work.
4. Start the worker.
5. Start the web app.
6. Verify `http://localhost:3000/api/ready`, `http://localhost:3000/api/health`, and `http://localhost:3000/api/ops`.

## Readiness and health

```bash
curl -s http://localhost:3000/api/ready
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/ops
```

## Environment notes

- `GRACENOTE_API_KEY` must be replaced with a real key. The provider client checks whether your `.env` value still matches the placeholder from `.env.example`, and availability syncs fail fast if it does.
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
