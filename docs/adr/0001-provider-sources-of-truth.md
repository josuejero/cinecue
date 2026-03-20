# ADR 0001: Provider sources of truth

- Status: Accepted
- Date: 2026-03-19

## Context

The product needs one source of truth for theatrical availability and a separate source for movie enrichment.

## Decision

- Gracenote is the source of truth for theatrical schedules, theaters, showtimes, and future releases.
- TMDB is the source for enrichment such as posters, cast, synopsis, genres, and artwork.
- The browser never talks to Gracenote or TMDB directly.
- The app exposes its own stable API contract.

## Consequences

- Provider credentials remain server-side.
- Provider adapters are isolated from client rendering concerns.
- Later provider changes do not force a client rewrite.