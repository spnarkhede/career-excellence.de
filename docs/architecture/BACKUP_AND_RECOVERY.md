# Backup and Recovery

## Backups

- Production PostgreSQL: automated daily backups + point-in-time recovery (PITR) enabled
  through the managed provider.
- Object storage: enable versioning on the private bucket.
- Configuration/secrets: stored in the managed secrets system of the hosting platform,
  not in backups of application code.

## Restoration testing

A backup is not considered valid until a restoration has been tested. Schedule a
quarterly restore drill:

1. Restore the latest production backup into an isolated environment.
2. Run the migration suite against it to confirm schema compatibility.
3. Run smoke tests against the restored instance.
4. Record the outcome (date, duration, issues found) in this file or a linked runbook.

## Recovery objectives

Define and track:

- **RPO** (Recovery Point Objective): maximum acceptable data loss window.
- **RTO** (Recovery Time Objective): maximum acceptable downtime during recovery.

Fill these in based on your product's requirements before launch.
