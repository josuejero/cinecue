# Cost and scaling review

## Objective

Track the cost drivers that matter before broader rollout.

## Main cost buckets

### 1. Provider calls

Primary drivers:

- active-location sync frequency
- sync lookahead window in days
- number of unique saved locations
- replay volume
- enrichment retry volume

Controls:

- keep location clustering enabled
- avoid per-user provider fanout
- use read models and cache on the request path
- replay only selected locations or movies when debugging

### 2. Queue and worker load

Primary drivers:

- active sync concurrency
- notification batch sizes
- retry storms during provider or SMTP incidents

Controls:

- keep batch sizes bounded
- keep retries explicit
- monitor failed jobs and stale location counts
- avoid infinite replay loops

### 3. Email delivery

Primary drivers:

- number of followed titles
- alert rules enabled
- duplicate or noisy transition logic

Controls:

- prefer fewer high-confidence notifications
- keep idempotent delivery keys
- monitor sent / failed / skipped ratios

### 4. Push delivery

Primary drivers:

- number of active browser subscriptions
- alert volume
- invalid subscription cleanup lag

Controls:

- deactivate dead subscriptions quickly
- keep push limited to high-intent transitions

### 5. Storage

Primary drivers:

- raw provider payload retention
- worker job history retention
- analytics events
- notification delivery records

Controls:

- keep cleanup jobs enabled
- keep retention windows explicit
- review archive growth monthly

## Phase 6 metrics to watch

- dashboard views
- searches
- follows
- unfollows
- search-to-follow conversion
- calendar exports
- provider sync runs 7d
- worker jobs 7d
- notification deliveries 30d
- stale location count
- recent failures

## Rollout guardrails

Do not widen launch scope if any of these are true:

- stale location count stays non-zero for long periods
- failed syncs trend upward week over week
- notification failures exceed an acceptable threshold
- search-to-follow conversion is weak because identity/search quality is still noisy
- provider economics no longer support current sync cadence

## Review cadence

### Weekly

- check `/api/ops/phase6`
- inspect stale locations
- inspect recent failures
- inspect notification sent/failed/skipped counts

### Monthly

- review raw payload archive size
- review worker job retention volume
- review top ZIP clusters by activity
- review whether sync intervals are still justified by demand

## Scaling direction

Scale in this order:

1. improve cache hit rates
2. tighten transition quality to reduce noisy alerts
3. optimize location clustering
4. optimize replay usage
5. only then consider broader geographic or feature expansion
