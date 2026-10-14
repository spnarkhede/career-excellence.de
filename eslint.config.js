import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
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
          allowDefaultProject: [
            "apps/*/*.config.mjs",
            "apps/*/*.config.js",
            "apps/*/*.config.mts",
            "*.config.js",
          ],
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
      "@typescript-eslint/no-deprecated": "error",
      // Phase 18 task 3: catches an async function with no `await` inside it — usually
      // a sign the function was meant to be async but forgot to await something, or
      // doesn't need to be async at all (misleading callers into treating it as one).
      "@typescript-eslint/require-await": "error",
      // Phase 18 task 4: an empty `catch {}` silently swallows an error with no
      // rethrow, no mapping to a catalog code, and no log — the single most common
      // way an auth failure goes unnoticed. `allowEmptyCatch: false` is the default,
      // stated explicitly so it can't be silently loosened later.
      "no-empty": ["error", { allowEmptyCatch: false }],
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
      // Mocking an async interface (e.g. a fake `fetch` Response's `.json()`/`.text()`,
      // or a fake OAuthProviderAdapter) with a literal return is legitimate test
      // fixture code, not the "forgot to await" bug this rule exists to catch in
      // production code — the production-code instances this rule found (Phase 18)
      // were fixed directly rather than exempted.
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    // Phase 16 task 1: "A lint rule fails on missing alt." No `<img>`/
    // `<Image>` exists anywhere in apps/web or apps/admin today (this is a
    // text/form-only app), so this has nothing to actually flag yet — it's
    // a forward-looking gate so the FIRST image anyone adds is forced to
    // carry (or explicitly omit, for a decorative image) alt text, rather
    // than this being caught in review after the fact.
    files: ["apps/web/**/*.{ts,tsx}", "apps/admin/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/img-redundant-alt": "error",
    },
  },
  {
    // Stage 5 #71 "Tokens": one designated set of modules creates/hashes/signs
    // every auth token; every other file is blocked from importing the raw
    // primitives directly, so a new token can't be minted by hand elsewhere
    // (checklist: "a lint rule blocks token generation outside this module").
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "packages/utils/src/index.ts", // generateSecureToken (raw opaque tokens)
      "packages/security/src/server.ts", // hashPassword/hashToken/hashIp
      "packages/security/src/server.spec.ts",
      "packages/auth/src/tokens.ts", // one-time-token/OTP issuance
      "packages/auth/src/oauth/pkce.ts", // PKCE verifier/challenge/state
      "apps/api/src/auth/auth.service.ts", // JWT access-token sign/verify
      "apps/api/test/phase7-tokens.spec.ts", // asserts against real jsonwebtoken output
      "apps/api/test/phase13-security-attacks.spec.ts", // forges attacker-controlled alg:none/HS256 tokens
      "**/*.config.{js,mjs,ts}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "jsonwebtoken",
              message:
                "JWT signing/verification is centralized in apps/api/src/auth/auth.service.ts. Import verifyAccessToken or add a method there instead.",
            },
          ],
          patterns: [
            {
              group: ["node:crypto", "crypto"],
              importNames: ["randomBytes", "createHash", "createHmac", "randomInt"],
              message:
                "Raw token/hash primitives are centralized in @saas/utils, @saas/security/server, and @saas/auth. Use generateSecureToken/hashToken/hashPassword/issueOneTimeToken instead.",
            },
          ],
        },
      ],
    },
  },
];
