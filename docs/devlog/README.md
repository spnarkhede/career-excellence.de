# Devlog

One file per phase (or per fix, if a fix lands outside a phase), named
`YYYY-MM-DD-phase-N.md`. Every entry uses this exact structure:

```
# YYYY-MM-DD — Phase N — vX.Y.Z

## What changed


## Why


## Files


## Tests run

(real pass/fail counts, never claimed without running them)

## Open issues

```

Rules:

- Date is the day the entry is written, in `YYYY-MM-DD` format.
- Version is the version recorded in `package.json` and `CHANGELOG.md` after this entry's
  change is applied (minor bump per phase, patch bump per standalone fix, per
  [AUTH_RULES.md](../../AUTH_RULES.md)).
- "Tests run" must report actual results, not assumed ones. If nothing was run, say so.
- "Open issues" links to the relevant entries in [docs/auth/FINDINGS.md](../auth/FINDINGS.md)
  when applicable.
- Every entry corresponds to a Conventional Commit and, where it closes out a phase, a
  git tag.
