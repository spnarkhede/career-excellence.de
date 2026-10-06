export type UUID = string;

export type AccountStatus = "pending_verification" | "active" | "suspended" | "deleted";

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
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface SecurityEvent {
  id: UUID;
  userId: UUID | null;
  type: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
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
