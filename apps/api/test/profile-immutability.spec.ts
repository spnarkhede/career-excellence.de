import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "@saas/validation";

// Second, independent layer of defense not exercised by this file: even if a future
// change to updateProfileSchema accidentally let role/status/userId through,
// ProfileController.updateMyProfile's `data: { displayName: dto.displayName }` object
// literal would still only ever write that one field — see apps/api/src/profile/profile.controller.ts.
describe("profile update cannot change role, status, or userId", () => {
  it("strips unknown fields (role, status, userId) from the parsed input", () => {
    const parsed = updateProfileSchema.parse({
      displayName: "New Name",
      role: "administrator",
      status: "active",
      userId: "someone-elses-id",
    });

    expect(parsed).toEqual({ displayName: "New Name" });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("userId");
  });
});
