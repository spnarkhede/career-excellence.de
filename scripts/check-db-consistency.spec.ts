import { describe, expect, it } from "vitest";
import { checkConsistency, isClean, type ConsistencyReport } from "./check-db-consistency";

function emptyReport(): ConsistencyReport {
  return {
    orphanedUsers: [],
    usersWithoutRoles: [],
    duplicateProfileUserIds: [],
    danglingSessions: [],
  };
}

describe("isClean", () => {
  it("is true when every category is empty", () => {
    expect(isClean(emptyReport())).toBe(true);
  });

  it("is false when any single category has an entry", () => {
    expect(isClean({ ...emptyReport(), orphanedUsers: ["u1"] })).toBe(false);
    expect(isClean({ ...emptyReport(), usersWithoutRoles: ["u1"] })).toBe(false);
    expect(isClean({ ...emptyReport(), duplicateProfileUserIds: ["u1"] })).toBe(false);
    expect(isClean({ ...emptyReport(), danglingSessions: ["s1"] })).toBe(false);
  });
});

describe("checkConsistency", () => {
  it("maps each query's rows into the matching report field", async () => {
    // A fake client whose $queryRaw returns a different canned result per call, in the
    // same order checkConsistency issues them (orphaned, no-role, duplicate, dangling).
    let call = 0;
    const responses = [
      [{ id: "orphan-1" }],
      [{ id: "no-role-1" }],
      [{ userid: "dup-1", cnt: 2n }],
      [{ id: "dangling-session-1" }],
    ];
    const fakeClient = {
      $queryRaw: async () => responses[call++],
    } as unknown as Parameters<typeof checkConsistency>[0];

    const report = await checkConsistency(fakeClient);
    expect(report.orphanedUsers).toEqual(["orphan-1"]);
    expect(report.usersWithoutRoles).toEqual(["no-role-1"]);
    expect(report.duplicateProfileUserIds).toEqual(["dup-1"]);
    expect(report.danglingSessions).toEqual(["dangling-session-1"]);
    expect(isClean(report)).toBe(false);
  });

  it("reports clean when every query returns no rows", async () => {
    const fakeClient = {
      $queryRaw: async () => [],
    } as unknown as Parameters<typeof checkConsistency>[0];

    const report = await checkConsistency(fakeClient);
    expect(isClean(report)).toBe(true);
  });
});
