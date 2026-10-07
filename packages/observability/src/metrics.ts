import { logger } from "./logger.js";

/**
 * Phase 12 task 6 ("Metrics and alerts"): no managed metrics backend
 * (Prometheus/Datadog/CloudWatch) is wired in this codebase — see
 * docs/auth/ERRORS.md and docs/auth/COMPONENTS.md for why that's
 * "Requires configuration," not implemented here. What IS implemented: a
 * single, structured log line per metric event (`event: "auth_metric"`),
 * with a stable `metric` name and a small set of labels — this is the
 * minimum real plumbing a future metrics backend (which typically scrapes
 * structured logs, e.g. via a log-based metrics pipeline) can key off of
 * without this code needing to change. Never log the raw error/request
 * body here — only the metric name and small, pre-vetted label values.
 *
 * Deliberately named `metricCode`/`metric`, not `code` — `packages/observability`'s
 * logger redacts any field literally named `code` (used elsewhere to scrub
 * OTP codes), which would silently blank out every metric event here.
 */
export type AuthMetricName =
  | "login_failure"
  | "login_success"
  | "rate_limited"
  | "refresh_reuse_detected"
  | "auth_5xx"
  | "email_send_failed";

export function recordAuthMetric(
  metric: AuthMetricName,
  labels: Record<string, string> = {},
): void {
  logger.info({ event: "auth_metric", metric, labels }, `auth_metric:${metric}`);
}
