# AUTH_RULES.md

1. Authentication is a security critical system. Inspect before modifying. Follow the actual code path. Trace errors to their root cause. Search the entire codebase for related logic.
2. Do not assume configuration is correct. Do not assume the frontend is telling the truth. Do not assume the backend is correct. Do not assume the auth provider is configured correctly.
3. Never hardcode secrets. Read them from environment variables. .env.example holds names and placeholder text only.
4. Never expose secrets, tokens, passwords, API keys, private keys or credentials in code, logs, errors, tests, commits or reports. If you find one, report the file and line and recommend rotation without reproducing the value.
5. Never remove security controls to make login work. Do not disable RLS, authentication, authorization, CORS, HTTPS, validation or security checks as a shortcut. Do not introduce insecure workarounds.
6. Never rely solely on frontend route protection for security. Every authorization decision happens on the server.
7. Do not blindly rewrite. Understand the existing architecture first. Prefer the smallest safe change that correctly fixes the root cause. Never silently modify unrelated functionality. Preserve existing intended behavior.
8. DO NOT STOP AT THE FIRST BUG. For every issue, investigate whether it connects to another one and report the complete chain. Example: Login failure → session not created → profile query fails → middleware redirects → redirect loop → user sees login failure.
9. Root cause record for every bug, written to docs/auth/FINDINGS.md: Bug ID, Component/file, Exact location, Problem, Root cause, Trigger, Impact, Reproduction steps, Expected behavior, Actual behavior, Why it happens, Related components, Recommended fix, Regression risk, How to test the fix.
10. Label every finding: Confirmed bug, Likely bug, Potential risk, Configuration issue, Missing information. Do not present guesses as confirmed facts. Do not invent errors the code or configuration cannot support. Clearly label uncertainty.
11. Severity. CRITICAL: authentication bypass, account takeover, severe security vulnerability, complete production failure. HIGH: major login failure, authorization vulnerability, session failure, serious production issue. MEDIUM: important functional bug or significant edge case failure. LOW: minor issue, UX problem, maintainability issue, low impact edge case. Do not artificially inflate severity.
12. After any change: re run the relevant flow, test the original failure, test related flows, test logout, test refresh, test protected routes, test expired sessions, test invalid credentials, test the relevant security controls, check for regressions.
13. Statuses, the only ones allowed: Confirmed working, Confirmed broken, Fixed, Requires configuration, Requires manual verification, Unable to verify. Do not claim something is fixed unless you verified it.
