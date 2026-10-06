import type { User } from "@saas/types";

let counter = 0;

export function buildTestUser(overrides: Partial<User> = {}): User {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `test-user-${counter}`,
    email: `test-user-${counter}@example.com`,
    emailVerifiedAt: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function resetTestFactories(): void {
  counter = 0;
}
