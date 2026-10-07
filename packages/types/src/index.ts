export type UUID = string;

export type AccountStatus = "pending_verification" | "active" | "disabled" | "locked" | "deleted";

export interface User {
  id: UUID;
  email: string;
  emailVerifiedAt: string | null;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  userId: UUID;
  displayName: string | null;
  avatarUrl: string | null;
}

export type RoleName = "user" | "support" | "moderator" | "administrator" | "super_administrator";

export type PermissionName =
  | "profile.read.own"
  | "profile.update.own"
  | "users.read"
  | "users.suspend"
  | "audit.read"
  | "settings.manage"
  | "content.manage";

export interface Role {
  id: UUID;
  name: RoleName;
  permissions: PermissionName[];
}

export interface SessionMetadata {
  id: UUID;
  userId: UUID;
  familyId: UUID;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  userAgent: string | null;
  ipHash: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface AuthEvent {
  id: UUID;
  userId: UUID | null;
  type: string;
  ipHash: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuthenticatedPrincipal {
  user: User;
  roles: RoleName[];
  permissions: PermissionName[];
  sessionId: UUID;
}

export interface ApiErrorShape {
  requestId: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
