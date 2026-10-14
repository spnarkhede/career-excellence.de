import { defineConfig } from "vitest/config";

// Phase 18 task 7: component-level tests (memory-leak/listener-count
// assertions) need a DOM — apps/web had jsdom/@testing-library/vitest as
// devDependencies with no test runner wired to use them until this phase.
// No @vitejs/plugin-react: Vite's built-in esbuild transform already handles
// .tsx (automatic JSX runtime) without it, and this monorepo's hoisted vite
// version is incompatible with the plugin's own vite peer (see the dedicated
// FINDINGS.md note on this).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.{ts,tsx}"],
  },
});
