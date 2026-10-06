# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately rather than opening a public issue.
Email `security@example.com` (placeholder — update with your real contact) with:

- A description of the vulnerability and its impact.
- Steps to reproduce.
- Any proof-of-concept code.

We aim to acknowledge reports within 2 business days.

## Supported versions

Only the `main` branch and the latest production release receive security fixes.

## Security practices in this repository

- Dependency vulnerability scanning and secret scanning run on every pull request.
- Secrets are never committed; see `.env.example` for the full list of required variables.
- All authentication and authorization logic is documented in [docs/authentication](docs/authentication) and [docs/authorization](docs/authorization).
- See [docs/security](docs/security) for the threat model, data classification, and security testing matrix.

## Disclosure

We request 90 days to remediate before public disclosure, and will credit reporters who wish to be credited.
