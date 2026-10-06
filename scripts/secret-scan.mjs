#!/usr/bin/env node
// Lightweight pre-commit secret scanner (gitleaks-equivalent for fast local use).
// CI additionally runs real gitleaks (.github/workflows/ci.yml) as the authoritative scan.
import { execSync } from "node:child_process";

const PATTERNS = [
  { name: "AWS Access Key ID", regex: /AKIA[0-9A-Z]{16}/ },
  {
    name: "Generic private key header",
    regex: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  },
  { name: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "Slack token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  {
    name: "JWT-looking token",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  // Catches a quoted literal assigned directly to a credential-named field, but not an
  // env-var reference such as `process.env.PASSWORD`, which is the required pattern here.
  // The negative lookbehind excludes compound identifiers like `VerificationToken` or
  // `AccessToken` (e.g. in a Mermaid erDiagram relationship label), which are not credential
  // assignments even though they contain the keyword as a suffix.
  {
    name: "Hardcoded credential-like literal",
    regex: /(?<![A-Za-z])(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'$]{8,}["']/i,
  },
];

function getStagedFiles() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" });
  return output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

function main() {
  let files;
  try {
    files = getStagedFiles();
  } catch {
    console.warn("secret-scan: not a git repository or no staged files — skipping.");
    return;
  }

  const violations = [];

  for (const file of files) {
    if (file === ".env" || /^\.env\.(?!example$)/.test(file)) {
      violations.push({ file, line: 0, name: "Real .env file staged for commit" });
      continue;
    }
    if (/node_modules|\.next|dist|coverage|pnpm-lock\.yaml/.test(file)) continue;

    let content;
    try {
      content = execSync(`git show :"${file}"`, { encoding: "utf8" });
    } catch {
      continue; // deleted or binary file
    }

    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      // Explicit, per-line opt-out for a human-verified non-secret (e.g. a fake fixture
      // value in a test asserting redaction/validation behavior). Never use this to
      // suppress a real credential — only a fictitious value a test deliberately contains.
      if (/secret-scan-ignore-line/.test(line)) return;
      for (const { name, regex } of PATTERNS) {
        if (regex.test(line)) {
          violations.push({ file, line: idx + 1, name });
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error("\nPotential secret(s) detected in staged changes:\n");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} — ${v.name}`);
    }
    console.error(
      "\nIf this is a real secret, do NOT commit it — rotate it immediately and remove it from the diff.\n" +
        "If this is a false positive, confirm it contains no real value before committing.\n",
    );
    process.exit(1);
  }

  console.log("secret-scan: no obvious secrets found in staged changes.");
}

main();
