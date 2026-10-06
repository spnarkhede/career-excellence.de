# Incident Response

## Severity levels

- **SEV1** — Full outage or active security breach. Page on-call immediately.
- **SEV2** — Major feature degraded (e.g. authentication partially failing).
- **SEV3** — Minor degradation, workaround available.

## Response steps

1. Acknowledge and declare severity.
2. Assign an incident commander.
3. Mitigate first (rollback, feature flag kill switch, revoke compromised credentials),
   root-cause later.
4. Communicate status to stakeholders at a regular cadence.
5. Once resolved, write a blameless postmortem within 5 business days.

## Security-specific actions

- Compromised credential: rotate immediately, revoke all affected sessions
  (`revokeOtherSessions`/direct DB update), force password reset.
- Suspected data breach: follow your legal/regulatory notification obligations in
  addition to the steps above.
- Leaked secret: rotate the credential immediately and audit access logs for misuse
  before considering the incident closed.

## Postmortem template

- Summary, timeline, impact, root cause, what went well, what to improve, action items
  with owners and due dates.
