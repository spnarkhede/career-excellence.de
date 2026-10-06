# Authorization

## Model

- **Roles**: `user`, `support`, `moderator`, `administrator`, `super_administrator`.
- **Permissions**: fine-grained strings such as `profile.read.own`, `profile.update.own`,
  `users.read`, `users.suspend`, `audit.read`, `settings.manage`, `content.manage`.
- Roles are a bundle of permissions (`role_permissions`); users hold roles (`user_roles`).

## Rule: never branch on role name

```ts
// Wrong
if (principal.roles.includes("administrator")) { ... }

// Right
import { can, assertPermission } from "@saas/authorization";
assertPermission(principal, "users.suspend");
```

This keeps authorization centralized and lets roles be restructured without touching
business logic.

## Resource ownership

Use `canAccessOwnResource` when an operation should be allowed either because the
caller owns the resource (with the "own" permission) or because they hold an elevated
permission (e.g. `users.read` lets support view any profile):

```ts
canAccessOwnResource(principal, resource.ownerId, "profile.read.own", "users.read");
```

## Every protected request, in order

1. Validate session (`SessionGuard`).
2. Resolve user; verify account status.
3. Resolve roles and permissions (`PrincipalService`).
4. Check resource ownership / organization scope.
5. Perform the operation.
6. Audit privileged operations (write to `audit_logs`).

## Admin app

`apps/admin` checks a distinct, elevated permission set independently of the normal user
app. A regular `user` role can never reach admin routes, and admin accounts should require
MFA (not yet implemented — wire TOTP via `@saas/auth` before enabling in production).
