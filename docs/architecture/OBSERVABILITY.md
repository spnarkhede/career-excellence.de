# Observability

## Logging

- `@saas/observability` exports a structured [pino](https://getpino.io) logger.
- Sensitive fields (`password`, `token`, `code`, `refreshToken`, `accessToken`, `authorization`)
  are redacted automatically — never log them manually either.
- Every request gets a `requestId` (see `RequestIdMiddleware`), propagated into logs and
  returned in the `x-request-id` response header and every `ApiError` body.

## Metrics to track in production

- API latency (p50/p95/p99) per route.
- Database query latency.
- Authentication failure rate.
- Authorization failure rate (abnormal spikes indicate probing).
- Worker job failure rate and queue depth.
- Storage errors.
- Deployment health (post-deploy smoke tests, error rate deltas).

## Error reporting

Wire Sentry via `SENTRY_DSN`. Do not attach request bodies, cookies, or auth headers to
error reports. Scrub PII from breadcrumbs.

## Tracing

`OTEL_EXPORTER_OTLP_ENDPOINT` is reserved for OpenTelemetry. Instrument the API's HTTP
layer and Prisma queries first; extend to the worker queues next.

## Health endpoints

- `GET /health/live` — process is running.
- `GET /health/ready` — process can reach the database.

Use `/health/ready` for deployment gating and load balancer health checks.
