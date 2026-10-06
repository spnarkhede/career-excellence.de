# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-06

### Added

- docs/auth/ARCHITECTURE.md: added "Project layout" (folder structure, module
  boundaries, layer ownership) and "Data connection diagram" (every table, FK, and
  which component reads/writes it) sections; added decision D10 and open question 9
  on database-level row-level security.
- docs/auth/FLOWS.md: Mermaid sequence diagrams for all 8 auth lifecycles (login,
  logout, refresh, signup, verification, password reset, OAuth, session expiration),
  each with failure branches and the HTTP status code produced.
- docs/auth/COMPONENTS.md: rewritten with a "Planned" entry, answering all 8
  component questions, for every item in the Authentication map checklist.
- docs/TRACEABILITY.md: filled in implementing files, tests, and status for every
  Phase 1 checklist item (System understanding, Lifecycle tracing, Authentication
  map), all marked "Requires manual verification" pending human confirmation.

### Notes

- No application code was written in this phase.
- Human confirmation of 9 open questions (listed in docs/auth/ARCHITECTURE.md and
  docs/auth/PROGRESS.md) is required before Phase 2 begins.

## [0.1.0] - 2026-10-06

### Added

- AUTH_RULES.md: the 13 governing rules for all authentication, authorization, and
  session work in this repository.
- docs/TRACEABILITY.md: traceability matrix covering every checklist item across
  Phases 0-21 of the authentication workstream.
- docs/auth/PROGRESS.md: phase-by-phase status tracker (Phase, Name, Status, Date,
  Version, Tests run, Notes).
- docs/auth/FINDINGS.md: root-cause finding template and log.
- docs/auth/COMPONENTS.md: component inventory template.
- docs/devlog/: development log folder with entry-format README.
- Conventional Commits enforcement via commitlint and a husky commit-msg hook.
- scripts/release.mjs: release script that bumps the version, updates CHANGELOG.md,
  and creates a git tag.
- References to AUTH_RULES.md from CLAUDE.md and AGENTS.md.

[Unreleased]: https://example.com/compare/v0.2.0...HEAD
[0.2.0]: https://example.com/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.com/releases/tag/v0.1.0
