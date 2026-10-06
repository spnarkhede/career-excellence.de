# Auth Workstream Progress

Statuses are restricted to the set in [AUTH_RULES.md](../../AUTH_RULES.md) rule 13:
Confirmed working, Confirmed broken, Fixed, Requires configuration, Requires manual
verification, Unable to verify. "Not started" is used only before a phase has begun.

| Phase | Name                                              | Status            | Date       | Version | Tests run   | Notes                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------- | ----------------- | ---------- | ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Project rules, traceability and development log   | Confirmed working | 2026-10-06 | 0.1.0   | `pnpm lint` | AUTH_RULES.md (13 rules, word for word), docs/TRACEABILITY.md, docs/auth/FINDINGS.md, docs/auth/COMPONENTS.md, this file, CHANGELOG.md, docs/devlog/, commitlint + husky commit-msg hook, scripts/release.mjs created. No application code touched. |
| 1     | System understanding, lifecycle tracing, auth map | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 2     | Launch: security basics                           | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 3     | Database tables and data connections              | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 4     | Signup and verification                           | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 5     | Login process                                     | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 6     | OTP authentication                                | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 7     | Session lifecycle                                 | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 8     | Password reset                                    | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 9     | OAuth providers and processes                     | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 10    | Routing and middleware                            | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 11    | Frontend auth UI                                  | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 12    | Error handling                                    | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 13    | Security checks                                   | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 14    | Launch: legal, trust and conversion               | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 15    | Launch: SEO and sharing                           | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 16    | Launch: performance and accessibility             | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 17    | Race conditions and edge cases                    | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 18    | Code defects that must not exist                  | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 19    | Test matrix                                       | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 20    | Production audit                                  | Not started       |            |         |             |                                                                                                                                                                                                                                                     |
| 21    | Final audit report                                | Not started       |            |         |             |                                                                                                                                                                                                                                                     |

## Phase 0 detail

### Done-when verification

1. All Phase 0 files exist at the required paths — **Confirmed working**: AUTH_RULES.md,
   docs/TRACEABILITY.md (every checklist item from this instruction set copied in, status
   "Not started"), docs/auth/PROGRESS.md (this file), docs/auth/FINDINGS.md,
   docs/auth/COMPONENTS.md, CHANGELOG.md, docs/devlog/README.md, package.json at 0.1.0,
   commitlint config + husky commit-msg hook, scripts/release.mjs.
2. commitlint rejects a malformed commit message — **Requires manual verification**: run
   `git commit -m "bad message"` against the hook; a Conventional Commits message is
   required to pass.
3. No application code was written in this phase — **Confirmed working**: only root/docs
   files, package.json metadata, and commit tooling were touched.

### Tests run

- `pnpm lint` — repository lint, documentation-only phase has no application code to
  exercise with Vitest/Supertest/Playwright for this specific phase.

### Open questions and risks

- **Missing information**: a prior session already produced `docs/auth/ARCHITECTURE.md`
  and an earlier-shaped `docs/auth/PROGRESS.md` under a different phase numbering
  (0-15). This phase re-creates PROGRESS.md under the 0-21 numbering required by this
  instruction set; ARCHITECTURE.md is left untouched for the next phase to reconcile.
- **Missing information**: this repository already contains a non-trivial existing
  NestJS/Prisma auth implementation from prior work. Phase 1 must decide whether to
  audit/extend it or treat it as reference only, per AUTH_RULES.md rule 7.
