/**
 * Defensive, name-only checks that catch a secret accidentally declared as a public
 * (browser-exposed) variable. These run against variable *names* from the schemas,
 * never against values, and never log a value.
 */

// Public variable names that are intentionally public despite containing a sensitive-looking
// substring (e.g. a write-only analytics key meant to be embedded in the client).
const PUBLIC_NAME_ALLOWLIST = new Set(["NEXT_PUBLIC_ANALYTICS_WRITE_KEY"]);

const SENSITIVE_SUBSTRINGS = ["SECRET", "PASSWORD", "PRIVATE", "TOKEN", "CREDENTIAL", "API_KEY"];

function containsSensitiveSubstring(name: string): boolean {
  const upper = name.toUpperCase();
  return SENSITIVE_SUBSTRINGS.some((s) => upper.includes(s));
}

/**
 * Throws if any public (browser-exposed) variable name looks like a secret, or if any
 * private variable name is incorrectly prefixed as public. Call this at startup for both
 * the web/admin build and the API so a misconfigured env schema fails loudly before any
 * value is ever read.
 */
export function assertNoPublicSecretLeakage(
  publicVariableNames: readonly string[],
  privateVariableNames: readonly string[],
): void {
  const offendingPublicNames = publicVariableNames.filter(
    (name) => containsSensitiveSubstring(name) && !PUBLIC_NAME_ALLOWLIST.has(name),
  );
  if (offendingPublicNames.length > 0) {
    throw new Error(
      `Secret-looking variable name(s) declared as public: ${offendingPublicNames.join(", ")}. ` +
        "Public variables are exposed to the browser bundle — rename or move to the private schema.",
    );
  }

  const misprefixedPrivateNames = privateVariableNames.filter((name) =>
    name.startsWith("NEXT_PUBLIC_"),
  );
  if (misprefixedPrivateNames.length > 0) {
    throw new Error(
      `Private variable(s) incorrectly use the public NEXT_PUBLIC_ prefix: ${misprefixedPrivateNames.join(", ")}.`,
    );
  }
}
