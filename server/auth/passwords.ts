import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derivePassword(password: string, salt: Buffer, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, { maxmem: 64 * 1024 * 1024 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export function validateStrongPassword(password: string) {
  if (password.length < 12 || password.length > 128) return "Use between 12 and 128 characters.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one symbol.";
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(24);
  const derived = await derivePassword(password, salt, 64);
  return { passwordHash: derived.toString("base64"), passwordSalt: salt.toString("base64") };
}

export async function verifyPassword(password: string, passwordHash: string, passwordSalt: string) {
  try {
    const expected = Buffer.from(passwordHash, "base64");
    const salt = Buffer.from(passwordSalt, "base64");
    const actual = await derivePassword(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
