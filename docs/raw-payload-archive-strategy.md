# Raw payload archive strategy

1. Every provider sync run gets a row in `provider_sync_runs`.
2. Every raw provider response used in ingestion is stored in `provider_payload_archive`.
3. Archive entries include provider, resource type, resource key, observed timestamp, and a SHA-256 payload hash.
4. Raw payloads are retained so mapping disputes and provider anomalies can be debugged after normalization.
5. Movie mapping conflicts reference the original source payload through `provider_mapping_conflicts.source_payload`.
6. The current implementation keeps this archive simple and append-only; retention policy can be added later.
