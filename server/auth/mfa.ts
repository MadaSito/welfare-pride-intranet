import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { Secret, TOTP } from "otpauth";

const ISSUER = "Welfare Pride";

export async function createTotpEnrollment(email: string) {
  const totp = new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new Secret({ size: 20 }),
  });
  const otpauthUrl = totp.toString();
  return {
    secret: totp.secret.base32,
    otpauthUrl,
    qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: "M", margin: 1, width: 256 }),
  };
}

export function verifyTotp(secretBase32: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new TOTP({ issuer: ISSUER, secret: Secret.fromBase32(secretBase32), digits: 6, period: 30 });
  return totp.validate({ token: code, window: 1 }) !== null;
}

export function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const value = randomBytes(5).toString("hex").toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}
