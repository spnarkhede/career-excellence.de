import { hashPassword, verifyPassword } from "@saas/security/server";
import type { AuthProvider, IdentityResult } from "./types";

interface StoredIdentity {
  email: string;
  passwordHash: string;
}

/**
 * Local development/testing auth provider backed by an in-memory map.
 * Replace with a real adapter (e.g. Auth0, Clerk, WorkOS) behind the same
 * AuthProvider interface for production.
 */
export class StubAuthProvider implements AuthProvider {
  private identities = new Map<string, StoredIdentity>();

  async verifyPassword(email: string, password: string): Promise<IdentityResult | null> {
    const stored = this.identities.get(email.toLowerCase());
    if (!stored) return null;
    const valid = await verifyPassword(stored.passwordHash, password);
    if (!valid) return null;
    return { providerId: email.toLowerCase(), email: stored.email };
  }

  async createPasswordIdentity(email: string, password: string): Promise<IdentityResult> {
    const key = email.toLowerCase();
    if (this.identities.has(key)) {
      throw new Error("An account with this email already exists.");
    }
    const passwordHash = await hashPassword(password);
    this.identities.set(key, { email, passwordHash });
    return { providerId: key, email };
  }

  async changePassword(providerId: string, newPassword: string): Promise<void> {
    const stored = this.identities.get(providerId);
    if (!stored) throw new Error("Identity not found.");
    stored.passwordHash = await hashPassword(newPassword);
  }
}
