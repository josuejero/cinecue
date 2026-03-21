# Phase 1 theatre normalization rules

1. Prefer the provider theatre external ID when available.
2. Store one canonical internal theatre record and keep provider IDs in `theatre_external_ids`.
3. Build `identity_key` from normalized theatre name + normalized address + postal code + country.
4. Update theatre records in place on repeat syncs rather than inserting duplicates.
5. Allow showtime-only theatre payloads to create provisional theatre records when address data is absent.
6. Backfill missing address and geo fields from the dedicated theatre sync.
7. Never key theatres purely by display name.