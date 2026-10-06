import { defineConfig } from "vitest/config";

// Covers root-level scripts/ (secret-scan, bundle-secret-check) which aren't inside any
// Turborepo workspace package and so wouldn't otherwise be picked up by `turbo run test`.
export default defineConfig({
  test: {
    include: ["scripts/**/*.spec.ts"],
  },
});
