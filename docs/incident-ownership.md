# Incident ownership map

## Primary owners

- Web app runtime: Engineering
- Worker runtime: Engineering
- Database operations: Engineering / Platform
- Redis / queue operations: Engineering / Platform
- Provider credential rotation: Engineering / Platform
- Scope and terminology decisions: Product

## Minimum response expectations

- Every recurring job has a named owner.
- Failed syncs are visible in logs and alerts.
- Provider outages have a documented manual response path.
- Readiness failures block release promotion until resolved.