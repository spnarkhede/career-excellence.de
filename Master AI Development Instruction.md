MASTER AI DEVELOPMENT INSTRUCTION

Production Ready SaaS Master Template

ROLE

Act as a principal software architect, senior full stack engineer, backend engineer, frontend engineer, database engineer, authentication engineer, application security engineer, DevOps engineer, cloud engineer, QA engineer, accessibility engineer, performance engineer, privacy engineer, SEO engineer, and production reliability engineer.

Your responsibility is to build a reusable, product neutral, production ready SaaS master template.

This is not a prototype.

This is not a demonstration application.

This is not a collection of disconnected boilerplate files.

Build a functioning foundation that future SaaS applications can extend without rebuilding authentication, authorization, security, database infrastructure, privacy controls, observability, deployment infrastructure, testing, SEO, accessibility, or application architecture.

Do not add product specific business features.

The finished template must provide a secure application foundation, public website foundation, authenticated application foundation, administration foundation, API, database, authentication, authorization, sessions, privacy controls, analytics abstraction, storage abstraction, background jobs, observability, testing, CI and CD, documentation, and deployment configuration.

CORE DEVELOPMENT RULE

Work phase by phase.

Complete, test, inspect, and verify one phase before proceeding to the next.

Never mark a phase complete because the code compiles.

A phase is complete only when its implementation, security controls, error handling, tests, documentation, and acceptance criteria pass.

If an existing project already contains code, inspect it before modifying anything.

Never blindly replace functioning architecture.

Prefer the smallest safe architectural change that satisfies the required design.

Never weaken authentication, authorization, RLS, CORS, CSP, CSRF protection, HTTPS, input validation, rate limiting, database constraints, or another security control to make a feature work.

Never expose passwords, API keys, access tokens, refresh tokens, private keys, database credentials, service credentials, webhook secrets, OTP values, reset tokens, or other secrets.

Never invent successful test results.

If something cannot be verified, report it as unable to verify.

PHASE 0. PROJECT DISCOVERY AND BASELINE

Before writing or changing application code, inspect the entire repository.

Determine:

1. Existing frontend framework.
2. Existing backend framework.
3. Package manager.
4. Runtime.
5. Monorepo configuration.
6. Database.
7. ORM.
8. Authentication provider.
9. API architecture.
10. Session architecture.
11. Cookie architecture.
12. Token architecture.
13. JWT implementation.
14. Refresh token implementation.
15. OAuth providers.
16. Email and password authentication.
17. OTP authentication.
18. Email verification.
19. Password recovery.
20. Session persistence.
21. Middleware.
22. Protected routes.
23. Roles.
24. Permissions.
25. User profile creation.
26. Database triggers.
27. Database functions.
28. Environment variables.
29. Development configuration.
30. Preview configuration.
31. Staging configuration.
32. Production configuration.
33. Deployment configuration.
34. CORS.
35. CSP.
36. Redirect handling.
37. Domain configuration.
38. HTTPS configuration.
39. Storage.
40. Third party integrations.
41. Analytics.
42. Monitoring.
43. Error tracking.
44. Testing.
45. CI and CD.
46. Existing security controls.
47. Existing documentation.
48. Existing technical debt.

Create an architecture map before making structural changes.

For each important component identify what it does, what calls it, what it calls, what data it receives, what data it returns, what happens when it fails, its trust level, its security implications, and whether it can create inconsistent state.

If starting from an empty repository, document that state and continue to Phase 1.

PHASE 1. ARCHITECTURE DECISION

Use a TypeScript monorepo.

Preferred architecture:

Frontend, Next.js with App Router.

UI, React, Tailwind CSS, shadcn/ui primitives, Radix primitives when appropriate, Lucide icons.

Backend, NestJS.

Database, PostgreSQL.

ORM, Prisma.

Cache and distributed controls, Redis.

Background processing, BullMQ.

Validation, Zod plus appropriate server validation.

Forms, React Hook Form.

Server state, TanStack Query where client side server state management is required.

Small client state, Zustand only where justified.

API style, REST with versioned routes and OpenAPI documentation.

Storage, private S3 compatible object storage.

Email, provider abstraction with a transactional email provider implementation.

Authentication, managed authentication provider behind an internal abstraction.

Monitoring, Sentry plus OpenTelemetry compatible instrumentation.

Testing, Vitest, Testing Library, Supertest, Playwright, axe, and k6.

Package manager, pnpm.

Monorepo orchestration, Turborepo.

Local infrastructure, Docker.

Repository, Git.

CI and CD, GitHub Actions or equivalent.

Do not introduce microservices.

Build a modular monolith with explicit domain boundaries.

Background workers may run as a separate process while sharing appropriate packages.

Document significant architecture decisions using Architecture Decision Records.

PHASE 2. REPOSITORY STRUCTURE

Create the following conceptual structure.

apps contains web, api, worker, and admin.

packages contains ui, design tokens, database, auth, authorization, contracts, validation, api client, config, security, storage, email, analytics, observability, feature flags, testing, types, and utilities.

infrastructure contains Docker configuration, database infrastructure, monitoring configuration, and operational scripts.

docs contains architecture, security, authentication, authorization, database, API, privacy, deployment, testing, decisions, and runbooks.

tests contains end to end, integration, security, accessibility, and performance tests.

.github contains workflows, CODEOWNERS, dependency update configuration, and repository automation.

Keep dependency direction clear.

Application packages may consume shared packages.

Shared packages must not depend on application packages.

Avoid circular dependencies.

Do not create generic utility dumping grounds.

PHASE 3. ENGINEERING FOUNDATION

Configure TypeScript strict mode.

Configure ESLint.

Configure formatting.

Configure import ordering.

Configure path aliases.

Configure workspace dependencies.

Configure build pipelines.

Configure development scripts.

Configure test scripts.

Configure production scripts.

Configure type checking.

Configure lint checking.

Configure clean builds.

Configure environment validation.

Configure Git hooks only where they improve developer experience without replacing CI.

Create standardized error types.

Create standardized API responses.

Create request correlation IDs.

Create health endpoint.

Create readiness endpoint.

Create application version reporting without exposing sensitive system information.

Ensure the entire repository builds from a clean installation.

PHASE 4. ENVIRONMENT AND SECRET ARCHITECTURE

Support four environments.

Local.

Preview.

Staging.

Production.

Create a typed environment schema.

Fail application startup when mandatory configuration is absent or malformed.

Separate public environment variables from server only variables.

Never expose private configuration through browser accessible prefixes.

Never commit actual .env files.

Commit an .env.example containing variable names, descriptions, and safe examples only.

Protect database credentials.

Protect Redis credentials.

Protect authentication secrets.

Protect OAuth client secrets.

Protect email provider credentials.

Protect storage credentials.

Protect webhook secrets.

Protect encryption keys.

Protect monitoring credentials where secret.

Protect service role credentials.

Enable repository secret scanning.

Enable push protection where supported.

Add CI secret scanning.

Redact sensitive values from logs and errors.

Document secret rotation procedures.

PHASE 5. DATABASE FOUNDATION

Configure PostgreSQL.

Configure Prisma.

Create migration infrastructure.

Create development seed infrastructure.

Create production safe migration procedures.

Create initial system entities for:

users.

profiles.

auth identities when application managed records are required.

sessions.

roles.

permissions.

role permissions.

user roles.

security events.

audit logs.

consents.

cookie preferences.

notification preferences.

files.

feature flags.

account deletion requests.

data export requests.

webhook events.

system settings where justified.

Use UUID identifiers.

Use created and updated timestamps.

Use explicit foreign keys.

Use unique constraints.

Use appropriate indexes.

Use explicit nullability.

Use explicit deletion behavior.

Use transactions for multi record consistency.

Do not use application validation as a replacement for database constraints.

Use database triggers only for integrity behavior that belongs in the database.

Do not hide ordinary business logic inside triggers.

Create backup strategy.

Create point in time recovery strategy for production.

Create documented restore procedure.

Test restoration in a safe environment.

PHASE 6. AUTHENTICATION FOUNDATION

Implement authentication behind an internal abstraction.

Support:

Email and password signup.

Email and password login.

Email verification.

Verification resend.

Forgot password.

Password reset.

Email OTP.

OAuth.

Google OAuth initially.

Architecture must allow Microsoft, GitHub, Apple, or other providers later.

Optional MFA foundation.

Session persistence.

Session refresh.

Session revocation.

Logout.

Logout from all devices.

Account disabling.

Account suspension.

Account deletion state.

Authentication security events.

Never store refresh tokens in localStorage.

Never expose provider service credentials to browser code.

Never trust client authentication state as authorization.

PHASE 7. SIGNUP LIFECYCLE

Implement this lifecycle.

User opens signup.

User enters credentials.

Client validates input.

Request reaches server.

Rate limiting runs.

Spam protection runs.

Server validates input.

Authentication provider creates identity.

Application user is created.

Default profile is created.

Default user role is assigned.

Required consent information is recorded.

Verification process begins.

Security event is recorded.

User receives verification pending state.

User verifies email.

Verification credential is validated.

Email becomes verified.

Verification credential becomes unusable.

User receives an authenticated session or returns to login according to configured policy.

Prevent duplicate account inconsistencies.

Handle partial account creation.

Handle profile creation failure.

Handle verification delivery failure.

Handle expired verification.

Handle verification resend.

Handle already verified users.

Test concurrency during account creation.

PHASE 8. LOGIN LIFECYCLE

Implement and trace:

User → Login UI → Client validation → Authentication request → Rate limit → Abuse protection → Server validation → Authentication provider → Identity verification → Application user resolution → Account status validation → Session creation → Secure cookie creation → Security event → Profile resolution → Permission resolution → Application authentication state → Protected route → Dashboard.

Test empty email.

Test invalid email.

Normalize email according to authentication provider rules.

Test whitespace.

Test empty password.

Test incorrect password.

Test correct credentials.

Test unverified accounts.

Test disabled accounts.

Test suspended accounts.

Test deleted accounts.

Test locked accounts where lockout exists.

Test rate limited accounts.

Test network failure.

Test timeout.

Test server error.

Test provider failure.

Test database failure.

Test invalid provider response.

Test expired existing session.

Test valid existing session.

Test repeated login.

Test double submission.

Test simultaneous login requests.

Test slow network.

Test offline behavior.

Test browser refresh during authentication.

Test multiple tabs.

Test multiple devices.

Test redirect after authentication.

Test redirect loops.

Test invalid return destinations.

Test profile load failure.

Test permission load failure.

PHASE 9. SESSION AND TOKEN ARCHITECTURE

Prefer Secure and HttpOnly browser cookies.

Configure SameSite deliberately based on deployment topology.

Configure cookie Domain deliberately.

Configure cookie Path deliberately.

Configure expiration deliberately.

Use short lived access credentials.

Use refresh credential rotation.

Maintain server side session metadata.

Track session identifier.

Track user identifier.

Track creation time.

Track last activity where appropriate.

Track expiration.

Track revocation.

Track revocation reason.

Track device metadata only when justified and privacy compliant.

Prevent session fixation.

Prevent stale revoked sessions.

Prevent refresh credential replay.

Handle concurrent refresh requests safely.

Handle multiple browser tabs.

Handle multiple devices.

Handle browser restart.

Handle session expiration while application is open.

Handle token expiration during API requests.

Never expose tokens in URLs.

Never log tokens.

Never put refresh credentials in localStorage or sessionStorage.

Never expose tokens through analytics.

Provide session management UI.

Allow current session identification.

Allow individual session revocation.

Allow revoke all other sessions.

PHASE 10. LOGOUT

Implement:

User selects logout.

Client calls logout endpoint.

Server validates session.

Session becomes revoked.

Provider session is terminated where required.

Refresh credentials become invalid.

Authentication cookies are cleared.

Security event is recorded.

Client clears sensitive application state.

Analytics identity resets where appropriate.

User returns to approved public route.

Protected pages become inaccessible.

Browser back navigation must not reveal usable protected state.

Test logout from multiple tabs.

Test logout while refresh is occurring.

Test logout from one device while another remains active.

Test global logout.

PHASE 11. PASSWORD RESET

Implement forgot password.

Use enumeration safe responses.

Rate limit requests.

Generate secure single purpose reset credentials through the authentication provider or approved server implementation.

Use short expiration.

Send transactional reset email.

Validate reset credentials.

Prevent reuse.

Update password.

Invalidate reset credential.

Apply session revocation policy after password change.

Record security event.

Send password changed notification.

Test expired links.

Test invalid links.

Test reused links.

Test multiple reset requests.

Test concurrent reset requests.

Test account enumeration.

Test unsafe redirects.

PHASE 12. OTP

Implement secure OTP authentication.

Use cryptographically secure generation through the authentication provider or approved server mechanism.

Use short expiration.

Limit attempts.

Rate limit generation.

Rate limit verification.

Prevent OTP logging.

Prevent OTP analytics capture.

Invalidate after success.

Invalidate after excessive failures.

Handle multiple OTP requests.

Define whether new OTP generation invalidates older OTPs.

Record security events.

PHASE 13. OAUTH

Implement OAuth using Authorization Code flow and PKCE where supported.

Generate and validate state.

Validate callback.

Use exact registered redirect URIs.

Validate provider identity.

Handle existing accounts safely.

Handle account linking safely.

Prevent account takeover through unsafe email matching.

Handle email collisions.

Handle provider identity collisions.

Handle unverified provider email according to provider semantics.

Handle cancellation.

Handle callback errors.

Handle retry.

Handle multiple browser tabs.

Handle mobile browser behavior.

Handle popup failure if popups are used.

Never accept arbitrary post authentication redirect destinations.

Maintain explicit redirect allowlists.

PHASE 14. AUTHORIZATION

Separate authentication, roles, permissions, resource ownership, and subscription entitlements.

Do not represent subscription tiers as security roles.

Create centralized authorization.

Example platform roles:

user.

support.

moderator.

administrator.

super administrator.

Create granular permissions.

Examples:

profile.read.own.

profile.update.own.

sessions.read.own.

sessions.revoke.own.

users.read.

users.suspend.

roles.manage.

audit.read.

settings.manage.

Every protected backend operation must validate required permissions.

Resource operations must validate ownership.

Administrative operations must generate audit events.

Never rely on hidden buttons.

Never rely solely on frontend route guards.

Never trust role values sent by clients.

PHASE 15. PROTECTED ROUTES

Implement server side route protection.

Frontend route guards may improve UX but are not security controls.

For protected operations:

Validate session.

Resolve user.

Validate account state.

Resolve roles.

Resolve permissions.

Validate resource ownership.

Validate organization scope when organizations are introduced.

Validate feature entitlement when applicable.

Perform operation.

Audit privileged operation when required.

Test direct URL access.

Test page refresh.

Test deep links.

Test browser back and forward navigation.

Test unauthenticated access.

Test authenticated access.

Test incorrect role.

Test incorrect permission.

Test user A attempting to access user B data.

PHASE 16. MIDDLEWARE AND API SECURITY

Create centralized middleware for:

Request IDs.

Structured logging.

Authentication.

Authorization where appropriate.

Rate limiting.

Origin validation.

CORS.

CSRF defenses where architecture requires them.

Request size limits.

Security headers.

Error normalization.

Performance measurement.

API versioning.

Create predictable error responses.

Use correct status codes.

Handle 400.

Handle 401.

Handle 403.

Handle 404.

Handle 409.

Handle 422.

Handle 429.

Handle 500.

Handle upstream 502.

Handle service unavailable 503.

Do not expose internal stack traces in production.

PHASE 17. CORS

Create explicit trusted origin lists.

Use separate configuration for local, preview, staging, and production.

Never use wildcard origin with credentialed authenticated requests.

Validate allowed methods.

Validate allowed headers.

Validate credentials behavior.

Validate preflight requests.

Validate WebSocket origins if WebSockets are later introduced.

PHASE 18. CSRF

Determine CSRF requirements from the final cookie architecture.

Protect state changing authenticated operations.

Use an appropriate framework supported strategy.

Validate Origin and related browser security signals where suitable.

Do not disable CSRF protections to solve integration issues.

Test cross site state changing requests.

PHASE 19. CSP AND SECURITY HEADERS

Create a restrictive Content Security Policy.

Define default source.

Define script source.

Define style source.

Define image source.

Define font source.

Define connect source.

Define frame source.

Define frame ancestors.

Avoid unsafe eval.

Reduce unsafe inline use.

Use CSP nonces where required.

Use report only mode during initial integration when appropriate.

Then enforce CSP.

Configure HSTS.

Configure MIME sniffing protection.

Configure Referrer Policy.

Configure Permissions Policy.

Configure frame protection.

Remove unnecessary server technology disclosure.

PHASE 20. HTTPS, DOMAINS, AND REDIRECTS

Production must use HTTPS.

Redirect HTTP to HTTPS.

Enable HSTS after HTTPS is confirmed.

Use Secure cookies.

Never allow production authentication over HTTP.

Document domain configuration.

Document API domain.

Document web domain.

Document admin domain.

Document authentication callback domains.

Maintain explicit redirect allowlists.

Reject open redirects.

Reject javascript and unsafe URI schemes.

Validate return URLs.

Validate OAuth callback URLs.

Prevent localhost references from entering production configuration.

PHASE 21. PROFILE SYSTEM

Create minimal reusable user profiles.

Create profile automatically or transactionally after identity creation.

Profile should remain product neutral.

Support basic fields required by the template only.

Do not collect unnecessary personal data.

Allow users to view profile.

Allow users to update permitted profile fields.

Validate ownership server side.

Handle missing profile.

Handle duplicate profile.

Handle partial creation.

Handle deleted profile.

Prevent cross user profile access.

PHASE 22. PRIVACY SYSTEM

Create a production privacy foundation.

Create Privacy Policy route.

Create Cookie Policy route.

Create Terms and Conditions route.

Create consent records.

Create cookie preferences.

Create data export request workflow.

Create account deletion request workflow.

Create retention policy architecture.

Create privacy contact placeholder.

Create subprocessor documentation structure.

Do not invent legal company information.

Use explicit placeholders for legal entity, address, registration information, jurisdiction, and contact information until supplied.

Mark legal documents for qualified legal review before production use.

PHASE 23. COOKIE CONSENT

Classify cookies as:

Necessary.

Preferences.

Analytics.

Marketing if later introduced.

Necessary cookies may operate without optional consent where legally appropriate.

Optional analytics must respect consent requirements.

Create banner.

Provide Accept All.

Provide Reject Optional.

Provide Manage Preferences.

Create preference center.

Store consent version.

Store timestamp.

Allow users to change preferences.

Ensure rejected analytics do not initialize.

Ensure withdrawal stops future optional tracking.

PHASE 24. ANALYTICS

Create an internal analytics abstraction.

Provide methods such as:

track.

identify.

page.

reset.

consentUpdated.

Do not call analytics vendor SDKs throughout the application directly.

Respect cookie preferences.

Never send passwords.

Never send tokens.

Never send OTP values.

Never send reset credentials.

Never send authorization headers.

Never send complete sensitive forms.

Reset user analytics identity on logout where appropriate.

Document analytics events.

PHASE 25. STORAGE

Create private object storage abstraction.

Use unpredictable object keys.

Record ownership.

Validate extension.

Validate MIME type.

Validate actual file signature when appropriate.

Enforce file size limits.

Use signed upload URLs where appropriate.

Use signed download URLs or authenticated download endpoints.

Never trust original filenames.

Prevent path traversal.

Prevent unauthorized file access.

Prepare malware scanning integration for applications that later accept risky uploads.

PHASE 26. EMAIL

Create provider independent email package.

Support transactional email templates for:

Verification.

Password reset.

Password changed.

OTP.

Security alert.

Account deletion.

Data export ready.

Session or account security notifications where required.

Prevent email header injection.

Never include secrets beyond single purpose credentials required for the transaction.

Do not log complete verification, OTP, or reset credentials.

PHASE 27. BACKGROUND WORKER

Create worker application.

Use Redis backed job queue.

Support retries.

Use exponential backoff where appropriate.

Create dead letter handling strategy.

Create job idempotency where needed.

Create observability.

Create graceful shutdown.

Do not perform long running work inside normal API requests when it belongs in a worker.

Use workers for email, exports, cleanup, scheduled tasks, webhook retries, and future asynchronous processing.

PHASE 28. WEBHOOK FOUNDATION

Create reusable webhook infrastructure.

Verify provider signatures.

Reject unsigned or invalid events.

Store event identifiers.

Implement idempotency.

Prevent duplicate processing.

Store processing status.

Support retries.

Record failure reason safely.

Never trust webhook payloads solely because they reached the endpoint.

PHASE 29. DESIGN SYSTEM

Create a reusable UI package.

Define typography.

Define spacing.

Define colors.

Define radii.

Define shadows.

Define breakpoints.

Define focus states.

Define semantic colors.

Build reusable components for buttons, inputs, textareas, selects, checkboxes, radio controls, switches, cards, badges, avatars, alerts, dialogs, drawers, sheets, dropdowns, popovers, tooltips, tabs, breadcrumbs, tables, data tables, pagination, forms, toasts, progress indicators, skeletons, empty states, loading states, error states, command interfaces, date controls, and navigation.

Avoid page specific duplicated components.

PHASE 30. ACCESSIBILITY

Target WCAG 2.2 AA.

Implement semantic HTML.

Implement keyboard navigation.

Implement visible focus indicators.

Implement accessible labels.

Associate errors with fields.

Manage focus in dialogs.

Support screen readers.

Respect reduced motion.

Meet text contrast requirements.

Meet interface contrast requirements.

Use appropriate touch target sizes.

Support browser zoom.

Test with automated accessibility tooling.

Perform manual keyboard testing.

PHASE 31. RESPONSIVE DESIGN

Use mobile first responsive architecture.

Test narrow mobile.

Test standard mobile.

Test large mobile.

Test tablet.

Test laptop.

Test desktop.

Test large desktop.

Ensure forms remain usable.

Ensure navigation remains usable.

Ensure dialogs remain usable.

Ensure tables have appropriate responsive behavior.

Ensure authentication screens work with mobile keyboards.

Prevent horizontal overflow.

PHASE 32. PUBLIC WEBSITE FOUNDATION

Create product neutral public pages.

Home.

Privacy.

Terms.

Cookie Policy.

Login.

Signup.

Forgot Password.

Verification.

OAuth callback.

Error states.

404.

Create one clear primary CTA on marketing pages.

Secondary actions must have lower visual priority.

Do not create competing primary actions in the same section.

PHASE 33. SEO

Create metadata architecture.

Every indexable page needs a unique title.

Every indexable page needs a useful description.

Create canonical URLs.

Create Open Graph metadata.

Create social preview image.

Create favicon.

Create appropriate icon variants.

Create robots.txt.

Create sitemap.xml.

Create web manifest if required.

Authenticated routes should normally be noindex.

Prevent staging and preview environments from accidental indexing.

PHASE 34. IMAGE SYSTEM

Use framework optimized image handling.

Compress images.

Serve suitable dimensions.

Use modern formats where supported.

Lazy load below the fold images.

Avoid unnecessary image preloading.

Provide meaningful alt text for meaningful images.

Use empty alt attributes for decorative images.

Prevent layout shift by defining dimensions or aspect ratio.

PHASE 35. ERROR EXPERIENCE

Create custom 404.

Create 403.

Create 500.

Create global application error boundary.

Create API failure states.

Create network failure state.

Create maintenance state.

Create offline handling where useful.

Provide safe recovery actions.

Never display internal stack traces.

Never display secrets.

Do not hide recoverable failures behind meaningless error messages.

PHASE 36. BROKEN LINK PROTECTION

Add automated internal link validation.

Check navigation.

Check footer.

Check sitemap routes.

Check authentication links.

Check legal pages.

Check redirects.

Check documentation where appropriate.

Use scheduled external link validation if needed.

Do not let unreliable external websites unnecessarily block every production deployment.

PHASE 37. PERFORMANCE

Establish budgets.

Target green Core Web Vitals.

Target Lighthouse performance of at least 90 on important public routes where realistic.

Monitor Largest Contentful Paint.

Monitor Interaction to Next Paint.

Monitor Cumulative Layout Shift.

Monitor JavaScript bundle sizes.

Monitor image payloads.

Monitor API p95 latency.

Monitor database query latency.

Prevent unnecessary third party scripts.

Use code splitting.

Use caching deliberately.

Use database indexes based on query patterns.

Add Lighthouse CI for important routes.

PHASE 38. OBSERVABILITY

Add correlation IDs.

Add structured logs.

Add error tracking.

Add performance monitoring.

Add OpenTelemetry compatible tracing.

Monitor API health.

Monitor database health.

Monitor Redis.

Monitor worker queues.

Monitor authentication failures.

Monitor authorization failures.

Monitor background job failures.

Monitor email failures.

Monitor webhook failures.

Monitor storage failures.

Monitor deployment health.

Create alerts for meaningful production failures.

Redact sensitive information.

PHASE 39. AUDIT LOGGING

Record security relevant events.

Login success.

Login failure where appropriate.

Logout.

Password change.

Password reset.

Email change.

Email verification.

MFA changes.

OAuth linking.

OAuth unlinking.

Session creation.

Session revocation.

Global session revocation.

Role changes.

Permission changes.

Administrative actions.

Account suspension.

Account reactivation.

Data export.

Account deletion.

Audit records must have controlled access.

Ordinary users must not modify audit records.

PHASE 40. ADMIN APPLICATION

Create a minimal secure admin foundation.

Require privileged authorization.

Require MFA for administrators before production.

Keep administration APIs protected independently.

Do not rely on hidden admin navigation.

Provide controlled user lookup.

Provide account status management where required.

Provide audit log viewing according to permissions.

Provide feature flag management according to permissions.

Record every privileged mutation.

Prevent administrators from casually accessing unnecessary sensitive data.

Follow least privilege.

PHASE 41. SPAM AND ABUSE PROTECTION

Rate limit authentication.

Rate limit password reset.

Rate limit OTP.

Rate limit verification resend.

Rate limit public forms.

Use generic responses where account enumeration is a concern.

Add risk based bot protection where required.

Use honeypots for appropriate anonymous forms.

Monitor abusive patterns.

Do not force CAPTCHA on every user interaction without reason.

PHASE 42. FRONTEND AUTHENTICATION UX

Audit and test:

Loading states.

Disabled states.

Double submissions.

Error visibility.

Correct error mapping.

Password visibility.

Password manager compatibility.

Browser autofill.

Form reset behavior.

Mobile keyboard behavior.

Focus management.

Keyboard navigation.

Screen readers.

Redirects.

Stale authentication state.

Protected content flashes.

Login page flashes for authenticated users.

Logout state.

Slow network.

Offline behavior.

Multiple tabs.

PHASE 43. RACE CONDITIONS

Actively test timing problems.

Two simultaneous login requests.

Login and logout simultaneously.

Login and refresh simultaneously.

Refresh and API request simultaneously.

Multiple refresh requests.

Multiple browser tabs.

Multiple devices.

Session expiration during an API request.

Browser refresh during authentication.

Browser closing during authentication.

Network disconnect.

Network reconnect.

Slow authentication provider.

Duplicate clicks.

Rapid navigation.

Session expiration while active.

Profile request before session initialization.

Profile request after logout.

Refresh rotation under concurrency.

Do not dismiss intermittent failures.

PHASE 44. SECURITY REVIEW

Test for:

Authentication bypass.

Authorization bypass.

Broken access control.

IDOR.

Horizontal privilege escalation.

Vertical privilege escalation.

Session fixation.

Session hijacking.

CSRF.

XSS.

Open redirects.

Token theft.

Credential leakage.

Password leakage.

Sensitive information leakage.

User enumeration.

Brute force.

Missing rate limits.

Weak password handling.

Unsafe password reset.

Unsafe email verification.

OAuth account takeover.

OAuth callback weaknesses.

Redirect URI weaknesses.

CORS errors.

Cookie errors.

JWT validation errors where JWTs are used.

Issuer validation.

Audience validation.

Expiration validation.

Client server trust violations.

Client side only authorization.

Frontend secrets.

Environment variable exposure.

Debug information in production.

Sensitive authentication information in logs.

Never print discovered secrets in reports.

Identify their location and require rotation instead.

PHASE 45. DEPENDENCY AND SUPPLY CHAIN SECURITY

Lock dependency versions appropriately.

Commit lockfile.

Enable automated dependency updates.

Run vulnerability scanning.

Review critical and high severity findings.

Avoid abandoned dependencies where practical.

Minimize dependency count.

Verify package provenance where tooling supports it.

Protect CI credentials.

Pin sensitive CI actions to trusted versions or immutable references where appropriate.

Apply least privilege to CI tokens.

PHASE 46. TESTING FOUNDATION

Create unit tests.

Create integration tests.

Create API tests.

Create database tests.

Create component tests.

Create E2E tests.

Create security tests.

Create accessibility tests.

Create performance tests.

Create production smoke tests.

Tests must run independently and predictably.

Never depend on production user data.

Use isolated test configuration.

PHASE 47. AUTHENTICATION TEST MATRIX

Test valid login.

Valid signup.

Valid verification.

Valid password reset.

Valid OTP.

Valid OAuth.

Valid refresh.

Valid logout.

Invalid email.

Invalid password.

Missing fields.

Expired token.

Invalid token.

Revoked session.

Expired verification.

Invalid verification.

Expired reset.

Invalid reset.

Unauthorized access.

Forbidden access.

Wrong role.

Wrong permission.

Development.

Preview.

Staging.

Production configuration.

Mobile.

Desktop.

Slow network.

Offline behavior.

Multiple tabs.

Multiple devices.

Brute force.

Rate limits.

Session theft assumptions.

CSRF.

XSS.

IDOR.

Privilege escalation.

Open redirects.

Token leakage.

PHASE 48. CI PIPELINE

For every pull request run:

Dependency installation.

Formatting verification.

Lint.

Type checking.

Unit tests.

Integration tests where feasible.

Security scanning.

Dependency scanning.

Secret scanning.

Build verification.

Accessibility checks.

Selected E2E tests.

Migration validation.

Generate preview deployment where supported.

Do not merge failing changes.

PHASE 49. DEPLOYMENT PIPELINE

Use:

Developer branch.

Pull request.

CI.

Preview deployment.

Code review.

Merge.

Staging deployment.

Migration validation.

Integration tests.

E2E tests.

Accessibility checks.

Smoke tests.

Production approval.

Production migration.

API deployment.

Worker deployment.

Web deployment.

Admin deployment.

Production smoke tests.

Monitoring verification.

Support rollback.

Do not call deployment successful until health checks and smoke tests pass.

PHASE 50. DATABASE MIGRATION SAFETY

Never manually edit production schemas.

Use versioned migrations.

Review destructive operations.

Use backward compatible migrations where possible.

Use expand and contract strategy for risky zero downtime changes.

Back up before high risk changes.

Validate migrations against staging.

Document rollback or recovery strategy.

PHASE 51. PRODUCTION CONFIGURATION REVIEW

Search the entire repository for development assumptions.

Find localhost URLs.

Find test credentials.

Find debug flags.

Find development callbacks.

Find insecure cookies.

Find disabled HTTPS.

Find permissive CORS.

Find development CSP rules.

Find console logging containing sensitive information.

Find source maps or debug exposure according to policy.

Find incorrect build time environment assumptions.

Find missing runtime variables.

Find preview URLs accidentally configured as production.

Verify reverse proxy behavior.

Verify CDN behavior.

Verify database connection limits.

Verify Redis connection limits.

Verify provider limits.

Verify timeouts.

Verify retry behavior.

PHASE 52. BACKUP AND DISASTER RECOVERY

Configure automated database backups.

Configure point in time recovery where available.

Define storage recovery.

Define Redis persistence expectations.

Define recovery point objective.

Define recovery time objective.

Document restore procedures.

Test restore.

Document provider outage response.

Document authentication provider outage behavior.

Document database outage behavior.

Document storage outage behavior.

Document rollback.

PHASE 53. INCIDENT RESPONSE

Create incident response documentation.

Define severity levels.

Define security incident process.

Define credential compromise process.

Define data breach escalation process.

Define secret rotation process.

Define session mass revocation process.

Define malicious administrator response.

Define dependency compromise response.

Define provider outage response.

Define evidence preservation expectations.

Define post incident review process.

PHASE 54. DOCUMENTATION

Create and maintain:

README.md.

ARCHITECTURE.md.

SECURITY.md.

AUTHENTICATION.md.

AUTHORIZATION.md.

DATABASE.md.

API.md.

PRIVACY.md.

ENVIRONMENTS.md.

DEPLOYMENT.md.

TESTING.md.

OBSERVABILITY.md.

BACKUP_AND_RECOVERY.md.

INCIDENT_RESPONSE.md.

THREAT_MODEL.md.

DATA_CLASSIFICATION.md.

CONTRIBUTING.md.

RELEASE_CHECKLIST.md.

Create Architecture Decision Records for important decisions.

Documentation must match the implemented system.

Do not document planned behavior as completed behavior.

PHASE 55. COMPLETE LIFECYCLE VERIFICATION

Before declaring the template complete, manually and automatically trace:

Signup lifecycle.

Email verification lifecycle.

Login lifecycle.

Session creation lifecycle.

Authenticated application initialization.

Protected route lifecycle.

API authorization lifecycle.

Session refresh lifecycle.

Session expiration lifecycle.

Logout lifecycle.

Global logout lifecycle.

Forgot password lifecycle.

Password reset lifecycle.

OTP lifecycle.

OAuth lifecycle.

Profile creation lifecycle.

Account suspension lifecycle.

Account deletion lifecycle.

Cookie consent lifecycle.

Analytics consent lifecycle.

Data export lifecycle.

For every lifecycle document:

Entry point.

Validation.

Frontend behavior.

API request.

Middleware.

Authentication.

Authorization.

Database operations.

Cookie or session operations.

Application state changes.

Redirects.

Success state.

Failure states.

Security controls.

Audit events.

Tests.

PHASE 56. FINAL SECURITY GATE

Production release must fail if:

Frontend secrets exist.

HTTPS is not enforced.

Authentication bypass exists.

Authorization relies solely on frontend logic.

Known critical security vulnerabilities remain.

CORS is dangerously permissive.

Production cookies are insecure.

Open redirects exist.

Sensitive tokens appear in URLs.

Refresh credentials use unsafe browser storage.

Password reset can be reused.

Verification credentials can be reused incorrectly.

OAuth state validation is missing.

Critical endpoints lack required rate limiting.

Admin routes lack server authorization.

Database access permits cross user access.

Secrets appear in logs.

Production environment configuration is incomplete.

Backup strategy does not exist.

Required privacy controls are missing.

PHASE 57. FINAL QUALITY GATE

Verify:

Privacy Policy exists.

Terms and Conditions exist.

Cookie Policy exists.

Cookie consent works.

Cookie preferences work.

Optional analytics follows consent.

No frontend secrets exist.

HTTPS is enforced.

CSP is configured.

CORS is configured.

Security headers are configured.

Meta titles exist.

Meta descriptions exist.

Canonical URLs exist.

Social preview exists.

Favicon exists.

Sitemap works.

robots.txt works.

Images are optimized.

Meaningful images have alt text.

Color contrast passes.

Mobile responsiveness passes.

404 works.

403 works.

500 handling works.

Internal links pass.

Forms have client validation.

Forms have server validation.

Spam protection works.

Analytics abstraction works.

Single primary CTA standard is followed.

Authentication works.

Signup works.

Verification works.

Password reset works.

OTP works.

OAuth works.

Refresh works.

Logout works.

Protected routes work.

Roles work.

Permissions work.

Profile creation works.

Session revocation works.

Audit logging works.

Environment validation works.

Database migrations work.

Backups are configured.

Restore procedure is tested.

Monitoring works.

Error tracking works.

CI works.

Deployment works.

Accessibility checks pass.

E2E tests pass.

Security tests pass.

Production smoke tests pass.

PHASE 58. ROOT CAUSE RULE

Do not stop at the first error.

When a failure occurs, trace the complete chain.

Example:

Login succeeds.

Session creation fails.

Profile request becomes unauthorized.

Middleware redirects.

Login page detects an existing partial state.

Redirect loop occurs.

User sees an authentication failure.

Report and repair the complete causal chain.

For every significant defect record:

ID.

Severity.

Component.

File.

Location.

Problem.

Root cause.

Trigger.

Impact.

Reproduction.

Expected behavior.

Actual behavior.

Related components.

Recommended fix.

Implemented fix.

Regression risk.

Verification method.

Final status.

Classify findings as Critical, High, Medium, or Low without inflating severity.

Distinguish confirmed bugs, likely bugs, potential risks, configuration issues, and missing information.

PHASE 59. FIXING RULE

Inspect before modifying.

Follow the real code path.

Identify the root cause.

Prefer the smallest safe fix.

Preserve intended behavior.

Never remove security controls as a workaround.

Never hardcode secrets.

Never expose credentials.

Never silently modify unrelated functionality.

After every meaningful fix:

Reproduce the original failure.

Verify the fix.

Test related flows.

Test login.

Test logout.

Test refresh.

Test protected routes.

Test expired sessions.

Test invalid credentials.

Test permissions.

Test relevant security controls.

Run regression tests.

PHASE 60. FINAL REPORT

At completion produce a report containing:

Executive Summary.

Implemented Architecture.

Repository Structure.

Technology Decisions.

Authentication Architecture.

Authorization Architecture.

Database Architecture.

Security Architecture.

Privacy Architecture.

Cookie Architecture.

API Architecture.

Deployment Architecture.

Observability Architecture.

Testing Architecture.

Complete Authentication Flow Map.

Environment Matrix.

Security Findings.

Resolved Findings.

Remaining Risks.

Configuration Requirements.

Manual Verification Requirements.

Test Results.

Performance Results.

Accessibility Results.

Production Readiness Checklist.

Deployment Instructions.

Rollback Instructions.

Known Limitations.

Recommended Future Improvements.

Final Status.

Only use factual status labels:

Confirmed working.

Confirmed broken.

Fixed and verified.

Requires configuration.

Requires manual verification.

Unable to verify.

Do not claim production readiness when mandatory checks remain unverified.

FINAL DEFINITION OF DONE

The master SaaS template is complete when a new developer can clone the repository, install dependencies, configure documented local environment variables, start required infrastructure, run database migrations, start the web application, start the API, start the worker, create an account, verify email, authenticate, use OTP where configured, use OAuth where configured, access a protected dashboard, edit their profile, refresh their session, inspect active sessions, revoke sessions, reset their password, log out, manage cookie preferences, request a data export, request account deletion, and receive correct authorization and error states.

A user must not access another user's protected data.

A normal user must not access administrator functionality.

Revoked sessions must stop working.

Expired sessions must follow the intended refresh or reauthentication lifecycle.

Optional analytics must obey consent.

Private secrets must never enter browser bundles.

Production must enforce HTTPS.

Security headers must be present.

CORS must use approved origins.

Redirects must be validated.

Database migrations must be reproducible.

Backups must exist.

Restore procedures must be documented and tested.

CI must pass.

Authentication tests must pass.

Authorization tests must pass.

Security tests must pass.

Accessibility tests must pass.

E2E tests must pass.

Production smoke tests must pass.

The repository must contain no product specific business domain.

The finished result must be a reusable SaaS foundation onto which a new product can be built without redesigning its core security, authentication, authorization, privacy, database, API, deployment, testing, accessibility, observability, or engineering infrastructure.

EXECUTION ORDER

Execute the phases in numerical order.

Do not skip a phase because it appears unnecessary.

If a phase genuinely does not apply to the selected architecture, document why it does not apply and verify that removing it does not leave a security, operational, privacy, accessibility, or reliability gap.

At the end of every phase provide:

Phase status.

Files created.

Files modified.

Architecture decisions made.

Database changes.

Environment changes.

Security controls implemented.

Tests added.

Tests executed.

Test results.

Issues found.

Issues fixed.

Outstanding issues.

Manual configuration required.

Acceptance criteria status.

Next phase.

Do not proceed past a blocking security or architectural failure without resolving it or explicitly reporting that execution cannot safely continue.

The objective is not to produce the largest codebase.

The objective is to produce a maintainable, secure, testable, observable, accessible, privacy aware, deployment ready SaaS foundation that future products can extend safely.
