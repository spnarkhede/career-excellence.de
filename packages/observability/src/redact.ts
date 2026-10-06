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
      result[key] = SENSITIVE_KEYS.has(normalizeKey(key)) ? REDACTED : deepRedact(val, depth + 1);
    }
    return result as T;
  }

  return value;
}
