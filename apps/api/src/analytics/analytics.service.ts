import { Injectable } from "@nestjs/common";
import { logger } from "@saas/observability";
import type { AnalyticsEventInput } from "@saas/validation";

// Checklist task 5: "never send emails, tokens or IDs in URLs or events."
// A value-shape check, independent of the key name — a client bug (or a
// malicious client) putting an email address or JWT-looking string into a
// `properties` value is caught here even though the schema itself only
// constrains the key→primitive SHAPE, not the content.
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JWT_LIKE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stripPiiShapedValues(
  properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof value === "string" &&
      (EMAIL_LIKE.test(value) || JWT_LIKE.test(value) || UUID_LIKE.test(value))
    ) {
      continue; // dropped silently — never forwarded, never logged as-is
    }
    safe[key] = value;
  }
  return safe;
}

/**
 * Phase 14 task 5 ("analytics setup"). No real analytics backend (PostHog/
 * Plausible/GA) is wired in this codebase — see docs/auth/COMPONENTS.md.
 * This is the minimum real server-side plumbing: a validated, PII-stripped
 * structured log line per event, which is exactly the shape a future
 * analytics backend integration would consume without this endpoint's
 * contract needing to change.
 */
@Injectable()
export class AnalyticsService {
  record(input: AnalyticsEventInput): void {
    const safeProperties = stripPiiShapedValues(input.properties);
    logger.info(
      { event: "client_analytics", name: input.event, properties: safeProperties },
      "Analytics event",
    );
  }
}
