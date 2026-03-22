# Provider failover strategy

## Purpose

Define how CineCue behaves when Gracenote or TMDB is partially or fully unavailable.

## Source-of-truth policy

- Gracenote remains the source of truth for theatrical availability.
- TMDB remains enrichment only.
- The browser never talks directly to either provider.

## Failure classes

### 1. Gracenote fully unavailable

Examples:

- DNS errors
- transport failures
- repeated 5xx responses
- auth failures that affect all showtime/future-release endpoints

Response:

- stop attempting user-request-path provider calls
- continue serving dashboard and movie detail from internal read models
- surface stale-data status in ops and readiness
- keep notification fanout paused for transitions that depend on fresh provider deltas
- do not delete existing showtimes just because the provider is down

Recovery:

- restore provider access
- run `phase4:sync-active`
- replay hot locations if needed
- verify `/api/ops/phase6`

### 2. Gracenote partially unavailable

Examples:

- dedicated theatre endpoint returns 403 but showings endpoint still works
- future releases unavailable but current showings still work

Response:

- keep syncing whatever endpoints still work
- create or update provisional theatre rows from showtime payloads
- do not block read-model refresh solely because dedicated theatre backfill is unavailable
- log partial degradation explicitly
- mark provider issue in ops docs and incident channel

Recovery:

- restore endpoint entitlement or provider behavior
- replay affected locations
- allow dedicated theatre sync to backfill missing venue fields

### 3. TMDB unavailable

Examples:

- TMDB token invalid
- TMDB 429 or 5xx
- enrichment calls timing out

Response:

- continue theatrical availability syncs
- keep existing posters and metadata already stored
- insert newly seen movies with Gracenote-only metadata if necessary
- queue enrichment retry later

Recovery:

- restore TMDB access
- re-run enrichment on movies missing poster, artwork, or external IDs

## Degradation rules by surface

### Dashboard

- serve cached and read-model data
- never hard-block dashboard rendering on live provider access

### Movie detail

- serve existing upcoming showings and theatre list from local data
- if refresh was requested during provider outage, keep current data and report stale state in ops

### Notifications

- do not emit new alerts from uncertain provider deltas
- retries are acceptable
- duplicates are not acceptable

## Replay commands

### Replay one location

```bash
npm run phase4:replay-location -- --location-id LOCATION_ID --start-date 2026-03-22 --num-days 7
```

### Replay one movie in one location

```bash
npm run phase4:replay-movie -- --location-id LOCATION_ID --movie-id MOVIE_ID
```

### Re-enqueue active locations

```bash
npm run phase4:sync-active -- --limit 100
```

### Check aggregate ops

```bash
npm run phase6:ops-report
```

## Operational expectations

- no showtime deletions caused purely by provider downtime
- no silent movie merges during provider anomalies
- all replays are idempotent
- stale-data conditions are visible in readiness and ops
- partial provider failures are documented with exact endpoint scope
