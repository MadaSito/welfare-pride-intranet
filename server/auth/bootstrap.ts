import { createHash } from "node:crypto";
import * as db from "../db";
import { hashPassword } from "./passwords";

export async function ensureBootstrapAdministrator() {
  if (process.env.BOOTSTRAP_DEFAULT_ADMIN?.toLowerCase() !== "true") return false;
  if (await db.hasLocalCredential()) return false;

  const password = await hashPassword("admin");
  await db.createInitialLocalAdmin({
    openId: `local:${createHash("sha256").update("bootstrap-admin").digest("hex").slice(0, 40)}`,
    name: "Local Administrator",
    email: "admin@local.invalid",
    credentialLogin: "admin",
    ...password,
    mustChangePassword: true,
    mfaRequired: true,
  });
  console.warn("A temporary local bootstrap administrator has been created. Change the bootstrap password and enroll MFA immediately.");
  return true;
}
