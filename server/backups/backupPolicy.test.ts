import { backupScopeLabel, normalizeLocalRetentionDays } from "./backupPolicy";
import { describe, expect, it } from "vitest";

describe("backup retention policy", () => {
  it("bounds local encrypted artifact retention to a safe administrative range", () => {
    expect(normalizeLocalRetentionDays(undefined)).toBe(30);
    expect(normalizeLocalRetentionDays(0)).toBe(1);
    expect(normalizeLocalRetentionDays(8000)).toBe(3650);
    expect(normalizeLocalRetentionDays(90.8)).toBe(90);
  });

  it("presents explicit backup scope labels without exposing secret content", () => {
    expect(backupScopeLabel("configuration_and_secrets")).toBe("configuration and secrets");
    expect(backupScopeLabel("full_platform")).toBe("full platform");
  });
});
