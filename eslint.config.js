import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// A plain array, not `tseslint.config(...)` (deprecated by typescript-eslint itself, in
// favor of ESLint core's own flat-config array/defineConfig) — functionally identical,
// just without triggering this file's own @typescript-eslint/no-deprecated rule.
export default [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Type-checked rules are opted into individually (not via recommendedTypeChecked's
    // full ruleset) so this phase adds exactly what it was asked for — no floating
    // promises, no misused promises, await-thenable, no deprecated APIs — without
    // forcing an unrelated rewrite of pre-existing code against no-unsafe-*/require-await.
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-level JS config files (next.config.mjs, tailwind.config.mjs, etc.) sit
          // outside every package's tsconfig `include` — let the default (unchecked)
          // project handle them instead of every app re-listing them.
          allowDefaultProject: ["apps/*/*.config.mjs", "apps/*/*.config.js", "*.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-deprecated": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // apps/web and apps/admin are React (Next.js App Router) — enforce the Hooks rules
    // that catch stale-closure and missing-cleanup bugs in auth state/session hooks.
    files: ["apps/web/**/*.{ts,tsx}", "apps/admin/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.spec.tsx", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
