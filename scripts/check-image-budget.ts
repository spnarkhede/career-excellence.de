// Phase 16 task 2: "a size budget per image enforced in CI." Scans every raster/vector
// image file actually committed to the repo (apps/*/public, apps/*/src) and fails if any
// exceeds the budget. There are no images in this repo today (confirmed: zero `<img>`/
// `<Image>` usage anywhere) — this exists so the FIRST image anyone adds is checked
// automatically, rather than relying on review to catch an oversized asset.
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

// 200 KiB per image — generous for a compressed photo, strict enough to catch an
// accidentally-committed uncompressed export. SVGs (text, not raster) rarely approach
// this, so one shared budget is simplest rather than a separate, smaller SVG-only limit.
export const IMAGE_SIZE_BUDGET_BYTES = 200 * 1024;

export interface ImageFile {
  path: string;
  sizeBytes: number;
}

export interface BudgetViolation {
  path: string;
  sizeBytes: number;
}

/** Pure check: given a list of image files, returns every one over budget. */
export function findOverBudgetImages(
  files: ImageFile[],
  budgetBytes: number = IMAGE_SIZE_BUDGET_BYTES,
): BudgetViolation[] {
  return files
    .filter((f) => f.sizeBytes > budgetBytes)
    .map((f) => ({ path: f.path, sizeBytes: f.sizeBytes }));
}

const SCAN_DIRS = [
  "apps/web/public",
  "apps/web/src",
  "apps/admin/public",
  "apps/admin/src",
  "packages/ui/src",
];

const IGNORED_DIR_NAMES = new Set(["node_modules", ".next", "dist", "coverage"]);

function walk(dir: string, files: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files; // directory doesn't exist (e.g. no public/ dir) — nothing to scan
  }
  for (const entry of entries) {
    if (IGNORED_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (IMAGE_EXTENSION_PATTERN.test(entry.name)) files.push(full);
  }
  return files;
}

function main() {
  const allPaths = SCAN_DIRS.flatMap((dir) => walk(dir));
  const files: ImageFile[] = allPaths.map((path) => ({ path, sizeBytes: statSync(path).size }));
  const violations = findOverBudgetImages(files);

  if (violations.length > 0) {
    console.error(
      `Image(s) exceed the ${(IMAGE_SIZE_BUDGET_BYTES / 1024).toFixed(0)} KiB per-image budget:`,
    );
    for (const v of violations) {
      console.error(` - ${v.path}: ${(v.sizeBytes / 1024).toFixed(1)} KiB`);
    }
    console.error("\nCompress the image (AVIF/WebP) or reduce its dimensions before committing.");
    process.exit(1);
  }

  console.log(
    files.length > 0
      ? `check:image-budget: ${files.length} image file(s) scanned, all under ${(IMAGE_SIZE_BUDGET_BYTES / 1024).toFixed(0)} KiB.`
      : "check:image-budget: no image files found to scan.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
