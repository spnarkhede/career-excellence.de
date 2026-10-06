// Scans built client bundle output for literal occurrences of private (server-only)
// environment variable NAMES. Never reads or prints values — this is a names-only check
// for accidental leakage of a server secret identifier into browser-shipped code.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { privateEnvSchema } from "../packages/config/src/index";

const SENSITIVE_NAME_PATTERN = /SECRET|PASSWORD|PRIVATE|TOKEN|CREDENTIAL|API_KEY|ENCRYPTION_KEY/i;

const sensitiveNames = Object.keys(privateEnvSchema.shape).filter((name) =>
  SENSITIVE_NAME_PATTERN.test(name),
);

const targetDirs = ["apps/web/.next", "apps/admin/.next"];

function walk(dir: string, files: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(js|html|json)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const found: { file: string; name: string }[] = [];

for (const dir of targetDirs) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, "utf8");
    for (const name of sensitiveNames) {
      if (content.includes(name)) {
        found.push({ file, name });
      }
    }
  }
}

if (found.length > 0) {
  console.error("Potential private environment variable name(s) found in client bundle output:");
  for (const f of found) console.error(` - ${f.name} referenced in ${f.file}`);
  console.error(
    "\nInvestigate immediately — this indicates a server-only variable name is reachable from browser-shipped code.",
  );
  process.exit(1);
}

console.log(
  targetDirs.some((d) => walk(d).length > 0)
    ? "check:bundle-secrets: no private environment variable names found in client bundle output."
    : "check:bundle-secrets: no build output found to scan (run `pnpm build` first) — skipped.",
);
