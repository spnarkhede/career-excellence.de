const REDACTED = "[redacted]";

// Matched case-insensitively with separators stripped, so "api_key", "api-key", "ApiKey",
// "Set-Cookie", "SET_COOKIE" etc. all match regardless of nesting depth in a logged object.
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "token",
  "secret",
  "refresh",
  "code",
  "apikey",
  "otp",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Substring match, not exact match: a compound field name like `refreshToken` or
// `accessToken` normalizes to `refreshtoken`/`accesstoken`, which never equals the
// literal word `token`/`refresh` — an earlier exact-match check silently let those
// two (very on-point) field names bypass redaction entirely. Checking "does the
// normalized key CONTAIN a sensitive keyword" closes that gap for every compound
// name built around one of these words (BUG-010; see docs/auth/FINDINGS.md).
function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  for (const keyword of SENSITIVE_KEYS) {
    if (normalized.includes(keyword)) return true;
  }
  return false;
}

/**
 * Recursively walks any value and replaces properties whose key matches a sensitive
 * name (at any depth) with a redaction marker. Arrays are walked, other values are
 * returned unchanged. Used to deep-redact log payloads before they are ever serialized.
 */
export function deepRedact<T>(value: T, depth = 0): T {
  if (depth > 20) return value;

  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, depth + 1)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? REDACTED : deepRedact(val, depth + 1);
    }
    return result as T;
  }

  return value;
}
