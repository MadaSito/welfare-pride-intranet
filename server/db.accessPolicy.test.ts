import { describe, expect, it } from "vitest";
import { ENTRA_GROUP_MEMBERSHIP_MAX_AGE_MS, isFreshEntraGroupMembership } from "./db";

describe("Entra membership freshness", () => {
  it("accepts current snapshots and fails closed for expired group memberships", () => {
    const now = Date.now();
    expect(isFreshEntraGroupMembership(new Date(now - ENTRA_GROUP_MEMBERSHIP_MAX_AGE_MS + 1), now)).toBe(true);
    expect(isFreshEntraGroupMembership(new Date(now - ENTRA_GROUP_MEMBERSHIP_MAX_AGE_MS - 1), now)).toBe(false);
  });
});
