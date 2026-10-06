#!/usr/bin/env node
/**
 * Release script: bumps the version in package.json, updates CHANGELOG.md, commits,
 * and creates a git tag. Usage: node scripts/release.mjs <major|minor|patch>
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bumpType = process.argv[2];

if (!["major", "minor", "patch"].includes(bumpType)) {
  console.error("Usage: node scripts/release.mjs <major|minor|patch>");
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, { cwd: root, stdio: "inherit" });
}

function capture(cmd) {
  return execSync(cmd, { cwd: root }).toString().trim();
}

const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

let nextVersion;
if (bumpType === "major") nextVersion = `${major + 1}.0.0`;
else if (bumpType === "minor") nextVersion = `${major}.${minor + 1}.0`;
else nextVersion = `${major}.${minor}.${patch + 1}`;

pkg.version = nextVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const today = new Date().toISOString().slice(0, 10);
const updated = changelog.replace(
  "## [Unreleased]",
  `## [Unreleased]\n\n## [${nextVersion}] - ${today}\n\n### Added\n\n- \n`,
);
writeFileSync(changelogPath, updated);

console.log(`Bumped version to ${nextVersion}.`);
console.log("Fill in the new CHANGELOG.md section before committing.");
console.log("Then run:");
console.log(`  git add package.json CHANGELOG.md`);
console.log(`  git commit -m "chore(release): v${nextVersion}"`);
console.log(`  git tag v${nextVersion}`);
