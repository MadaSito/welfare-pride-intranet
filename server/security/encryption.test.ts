import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configuredSecretMask, decryptJson, encryptJson } from "./encryption";

describe("encrypted configuration", () => {
  const previous = process.env.JWT_SECRET;
  beforeEach(() => { process.env.JWT_SECRET = "test-only-welfare-pride-jwt-secret-123456789"; });
  afterEach(() => { process.env.JWT_SECRET = previous; });

  it("round-trips secrets without including plaintext in the stored envelope", () => {
    const value = { clientSecret: "super-secret-value", connectionString: "AccountKey=private" };
    const encrypted = encryptJson(value);
    expect(encrypted).not.toContain(value.clientSecret);
    expect(encrypted).not.toContain("AccountKey=private");
    expect(decryptJson(encrypted)).toEqual(value);
  });

  it("returns configured booleans rather than secret values", () => {
    expect(configuredSecretMask({ clientSecret: "hidden", empty: "", absent: undefined })).toEqual({ clientSecret: true, empty: false, absent: false });
  });
});
