import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { hashPassword, validateStrongPassword, verifyPassword } from "../auth/passwords";
import { issueAppSession, revokeRequestSession, type LocalAuthState } from "../auth/session";
import { createTotpEnrollment, generateRecoveryCodes, verifyTotp } from "../auth/mfa";
import { decryptJson, encryptJson } from "../security/encryption";

const genericLoginError = () => new TRPCError({ code: "UNAUTHORIZED", message: "Username or password is incorrect." });
const codeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the six-digit authentication code.");

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function requiredAuthState(credential: { mustChangePassword: boolean; mfaRequired: boolean; mfaEnabled: boolean }): LocalAuthState {
  if (credential.mustChangePassword) return "password_change_required";
  if (credential.mfaRequired && !credential.mfaEnabled) return "mfa_enrollment_required";
  if (credential.mfaRequired) return "mfa_verification_required";
  return "full";
}

async function replaceWithSession(ctx: { req: Parameters<typeof issueAppSession>[0]; res: Parameters<typeof issueAppSession>[1] }, userId: number, state: LocalAuthState) {
  await revokeRequestSession(ctx.req);
  await issueAppSession(ctx.req, ctx.res, userId, state);
}

function requireLocalStep(ctx: { user: { id: number } | null; authState: LocalAuthState | null }, expected: LocalAuthState) {
  if (!ctx.user || ctx.authState !== expected) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This account security step is not currently available." });
  }
  return ctx.user.id;
}

export const localAuthRouter = router({
  status: publicProcedure.query(async () => ({
    setupRequired: !(await db.hasLocalCredential()),
    bootstrapDefaultEnabled: process.env.BOOTSTRAP_DEFAULT_ADMIN?.toLowerCase() === "true",
  })),
  me: publicProcedure.query(({ ctx }) => ctx.user ? { user: ctx.user, authState: ctx.authState } : null),
  setupOwner: publicProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(320),
      password: z.string().min(12).max(128),
    }))
    .mutation(async ({ ctx, input }) => {
      if (await db.hasLocalCredential()) throw new TRPCError({ code: "CONFLICT", message: "Owner setup is already complete." });
      const passwordError = validateStrongPassword(input.password);
      if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });
      const email = normalizeLogin(input.email);
      const password = await hashPassword(input.password);
      try {
        const user = await db.createInitialLocalAdmin({
          openId: `local:${createHash("sha256").update(email).digest("hex").slice(0, 40)}`,
          name: input.name.trim(),
          email,
          ...password,
          mfaRequired: true,
        });
        await issueAppSession(ctx.req, ctx.res, user.id, "mfa_enrollment_required");
        return { success: true, authState: "mfa_enrollment_required" } as const;
      } catch (error) {
        if (error instanceof Error && error.message.includes("already complete")) throw new TRPCError({ code: "CONFLICT", message: error.message });
        throw error;
      }
    }),
  login: publicProcedure
    .input(z.object({ identifier: z.string().trim().min(1).max(320), password: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.getLocalCredentialByEmail(normalizeLogin(input.identifier));
      if (!result) {
        await hashPassword(input.password);
        throw genericLoginError();
      }
      const { credential, user } = result;
      if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) throw genericLoginError();
      const valid = await verifyPassword(input.password, credential.passwordHash, credential.passwordSalt);
      if (!valid) {
        const failedAttempts = credential.failedAttempts + 1;
        const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
        await db.recordLocalLoginFailure(credential.id, lockedUntil ? 0 : failedAttempts, lockedUntil);
        throw genericLoginError();
      }
      await db.clearLocalLoginFailures(credential.id);
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      const authState = requiredAuthState(credential);
      await issueAppSession(ctx.req, ctx.res, user.id, authState);
      return { success: true, authState } as const;
    }),
  changeBootstrapPassword: publicProcedure
    .input(z.object({ password: z.string().min(12).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireLocalStep(ctx, "password_change_required");
      const passwordError = validateStrongPassword(input.password);
      if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });
      const credential = await db.getLocalCredentialByUserId(userId);
      if (!credential) throw new TRPCError({ code: "NOT_FOUND", message: "Local credentials were not found." });
      const password = await hashPassword(input.password);
      await db.updateLocalPassword({ credentialId: credential.id, ...password });
      await db.revokeAllAppSessionsForUser(userId);
      await issueAppSession(ctx.req, ctx.res, userId, credential.mfaRequired && !credential.mfaEnabled ? "mfa_enrollment_required" : "full");
      return { success: true, nextStep: credential.mfaRequired && !credential.mfaEnabled ? "mfa_enrollment_required" : "full" } as const;
    }),
  beginMfaEnrollment: publicProcedure.mutation(async ({ ctx }) => {
    const userId = requireLocalStep(ctx, "mfa_enrollment_required");
    const credential = await db.getLocalCredentialByUserId(userId);
    if (!credential) throw new TRPCError({ code: "NOT_FOUND", message: "Local credentials were not found." });
    const enrollment = await createTotpEnrollment(credential.email);
    await db.savePendingTotpSecret(credential.id, encryptJson({ secret: enrollment.secret }));
    return { qrCodeDataUrl: enrollment.qrCodeDataUrl, manualKey: enrollment.secret } as const;
  }),
  confirmMfaEnrollment: publicProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireLocalStep(ctx, "mfa_enrollment_required");
      const credential = await db.getLocalCredentialByUserId(userId);
      if (!credential?.totpSecretEncrypted) throw new TRPCError({ code: "BAD_REQUEST", message: "Start MFA enrollment before confirming it." });
      const { secret } = decryptJson<{ secret: string }>(credential.totpSecretEncrypted);
      if (!verifyTotp(secret, input.code)) throw new TRPCError({ code: "BAD_REQUEST", message: "The authentication code is not valid." });
      const recoveryCodes = generateRecoveryCodes();
      await db.enableLocalMfa({ credentialId: credential.id, encryptedRecoveryCodes: encryptJson({ codes: recoveryCodes }) });
      await replaceWithSession(ctx, userId, "full");
      return { success: true, recoveryCodes } as const;
    }),
  verifyMfa: publicProcedure
    .input(z.object({ code: z.string().trim().min(6).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const userId = requireLocalStep(ctx, "mfa_verification_required");
      const credential = await db.getLocalCredentialByUserId(userId);
      if (!credential?.mfaEnabled || !credential.totpSecretEncrypted) throw new TRPCError({ code: "BAD_REQUEST", message: "MFA is not enrolled for this account." });
      const { secret } = decryptJson<{ secret: string }>(credential.totpSecretEncrypted);
      const normalized = input.code.toUpperCase();
      let valid = verifyTotp(secret, normalized);
      if (!valid && credential.recoveryCodesEncrypted) {
        const recovery = decryptJson<{ codes: string[] }>(credential.recoveryCodesEncrypted);
        const remaining = recovery.codes.filter(code => code !== normalized);
        valid = remaining.length !== recovery.codes.length;
        if (valid) await db.consumeRecoveryCode(credential.id, encryptJson({ codes: remaining }));
      }
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "The authentication code is not valid." });
      await replaceWithSession(ctx, userId, "full");
      return { success: true } as const;
    }),
  setMfaRequirement: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), required: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.setLocalMfaRequired(input);
      return { success: true } as const;
    }),
  listLocalMfaPolicies: adminProcedure.query(async () => db.listLocalMfaPolicies()),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await revokeRequestSession(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
