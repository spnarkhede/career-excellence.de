# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
