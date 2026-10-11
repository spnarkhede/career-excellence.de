import { describe, expect, it } from "vitest";
import {
  findOverBudgetImages,
  IMAGE_EXTENSION_PATTERN,
  IMAGE_SIZE_BUDGET_BYTES,
} from "./check-image-budget";

describe("findOverBudgetImages", () => {
  it("flags an image larger than the budget", () => {
    const files = [{ path: "apps/web/public/hero.png", sizeBytes: 500 * 1024 }];
    const violations = findOverBudgetImages(files, 200 * 1024);
    expect(violations).toEqual([{ path: "apps/web/public/hero.png", sizeBytes: 500 * 1024 }]);
  });

  it("passes images at or under the budget", () => {
    const files = [
      { path: "apps/web/public/icon.svg", sizeBytes: 1024 },
      { path: "apps/web/public/exact.png", sizeBytes: 200 * 1024 },
    ];
    expect(findOverBudgetImages(files, 200 * 1024)).toHaveLength(0);
  });

  it("uses the default 200 KiB budget when none is passed", () => {
    const files = [{ path: "apps/web/public/big.jpg", sizeBytes: IMAGE_SIZE_BUDGET_BYTES + 1 }];
    expect(findOverBudgetImages(files)).toHaveLength(1);
  });
});

describe("IMAGE_EXTENSION_PATTERN", () => {
  it("matches common raster/vector image extensions, case-insensitively", () => {
    for (const name of [
      "a.png",
      "a.PNG",
      "a.jpg",
      "a.jpeg",
      "a.gif",
      "a.webp",
      "a.avif",
      "a.svg",
    ]) {
      expect(IMAGE_EXTENSION_PATTERN.test(name)).toBe(true);
    }
  });

  it("does not match non-image extensions", () => {
    for (const name of ["a.ico", "a.tsx", "a.js", "a.json"]) {
      expect(IMAGE_EXTENSION_PATTERN.test(name)).toBe(false);
    }
  });
});
