import { describe, expect, it } from "vitest";
import { Secret, TOTP } from "otpauth";
import { createTotpEnrollment, generateRecoveryCodes, verifyTotp } from "./mfa";

describe("local TOTP MFA", () => {
  it("creates a QR-compatible enrollment secret and accepts the current six-digit token", async () => {
    const enrollment = await createTotpEnrollment("admin@local.invalid");
    expect(enrollment.secret).toMatch(/^[A-Z2-7]+$/);
    expect(enrollment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const totp = new TOTP({ issuer: "Welfare Pride", secret: Secret.fromBase32(enrollment.secret), digits: 6, period: 30 });
    expect(verifyTotp(enrollment.secret, totp.generate())).toBe(true);
  });

  it("rejects malformed and incorrect TOTP values", () => {
    const secret = new Secret({ size: 20 }).base32;
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "ABCDEF")).toBe(false);
  });

  it("generates ten uniquely formatted recovery codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every(code => /^[A-F0-9]{5}-[A-F0-9]{5}$/.test(code))).toBe(true);
  });
});
