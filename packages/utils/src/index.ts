import { randomBytes, randomUUID } from "node:crypto";

export function uuid(): string {
  return randomUUID();
}

/** Generates a URL-safe random token suitable for one-time use (verification, reset, OTP transport). */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function isExpired(expiresAt: Date | string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
