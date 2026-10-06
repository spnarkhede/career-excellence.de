# Release Checklist

Before promoting to production, confirm every item:

- [ ] Privacy policy, terms, cookie policy published with real legal-entity details
- [ ] Cookie consent banner working; consent persisted with version
- [ ] Data export and account deletion flows implemented and tested
- [ ] HTTPS enforced; HTTP redirects to HTTPS
- [ ] Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy,
      Permissions-Policy) verified in production response headers
- [ ] CORS allowlist contains only real production origins
- [ ] All secrets rotated from any preview/staging values; none committed to git
- [ ] OAuth callback URLs registered exactly for production
- [ ] DNS, redirects, robots.txt, sitemap.xml verified
- [ ] Page metadata, social preview image, favicon set in place
- [ ] Images optimized; meaningful alt text present
- [ ] Accessibility checks pass (axe, keyboard nav, focus states)
- [ ] Mobile responsiveness verified at all standard breakpoints
- [ ] Custom 404/403/500/maintenance states verified
- [ ] Forms have client + server validation and spam protection
- [ ] Analytics respects consent; no PII sent to analytics
- [ ] Backups enabled; a restoration has been tested successfully
- [ ] Monitoring, error reporting, and alerting configured
- [ ] Rate limits verified on authentication endpoints
- [ ] Dependency and secret scanning passing in CI
- [ ] Full authentication/authorization test matrix passing
- [ ] E2E and production smoke tests passing
