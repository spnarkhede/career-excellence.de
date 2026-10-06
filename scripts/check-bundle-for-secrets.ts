// Scans built client bundle output for literal occurrences of private (server-only)
// environment variable NAMES. Never reads or prints values — this is a names-only check
// for accidental leakage of a server secret identifier into browser-shipped code.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { privateEnvSchema } from "../packages/config/src/index";

export const SENSITIVE_NAME_PATTERN =
  /SECRET|PASSWORD|PRIVATE|TOKEN|CREDENTIAL|API_KEY|ENCRYPTION_KEY/i;

export function getSensitiveNames(schemaShape: Record<string, unknown>): string[] {
  return Object.keys(schemaShape).filter((name) => SENSITIVE_NAME_PATTERN.test(name));
}

export interface BundleFile {
  path: string;
  content: string;
}

export interface BundleLeak {
  file: string;
  name: string;
}

/** Pure scan: given bundle files and a list of sensitive variable names, returns every
 * (file, name) pair where the name appears literally in the file's content. */
export function findLeakedSecretNames(files: BundleFile[], sensitiveNames: string[]): BundleLeak[] {
  const found: BundleLeak[] = [];
  for (const file of files) {
    for (const name of sensitiveNames) {
      if (file.content.includes(name)) {
        found.push({ file: file.path, name });
      }
    }
  }
  return found;
}

// Only `.next/static` is ever served to the browser. `.next/server` is Node-only SSR
// output that legitimately bundles the env schema's variable *names* (as string keys,
// never values) via the shared @saas/config import — scanning it produces false
// positives on code that never reaches a client.
const targetDirs = ["apps/web/.next/static", "apps/admin/.next/static"];

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

function main() {
  const sensitiveNames = getSensitiveNames(privateEnvSchema.shape);
  const allFiles = targetDirs.flatMap((dir) => walk(dir));
  const bundleFiles: BundleFile[] = allFiles.map((path) => ({
    path,
    content: readFileSync(path, "utf8"),
  }));
  const found = findLeakedSecretNames(bundleFiles, sensitiveNames);

  if (found.length > 0) {
    console.error("Potential private environment variable name(s) found in client bundle output:");
    for (const f of found) console.error(` - ${f.name} referenced in ${f.file}`);
    console.error(
      "\nInvestigate immediately — this indicates a server-only variable name is reachable from browser-shipped code.",
    );
    process.exit(1);
  }

  console.log(
    allFiles.length > 0
      ? "check:bundle-secrets: no private environment variable names found in client bundle output."
      : "check:bundle-secrets: no build output found to scan (run `pnpm build` first) — skipped.",
  );
}

// Only run the CLI when executed directly (not when imported by a test). Resolves both
// sides through path/URL helpers rather than comparing raw strings, so it works whether
// argv[1] is relative or absolute, and regardless of path separator (Windows vs POSIX).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
