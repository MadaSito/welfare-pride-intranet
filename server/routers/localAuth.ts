import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";
import { hashPassword, validateStrongPassword, verifyPassword } from "../auth/passwords";
import { issueAppSession, revokeRequestSession } from "../auth/session";

const genericLoginError = () => new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const localAuthRouter = router({
  status: publicProcedure.query(async () => ({
    setupRequired: !(await db.hasLocalCredential()),
  })),
  me: publicProcedure.query(({ ctx }) => ctx.user),
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
      const email = normalizeEmail(input.email);
      const password = await hashPassword(input.password);
      try {
        const user = await db.createInitialLocalAdmin({
          openId: `local:${createHash("sha256").update(email).digest("hex").slice(0, 40)}`,
          name: input.name.trim(),
          email,
          ...password,
        });
        await issueAppSession(ctx.req, ctx.res, user.id);
        return { success: true, user } as const;
      } catch (error) {
        if (error instanceof Error && error.message.includes("already complete")) throw new TRPCError({ code: "CONFLICT", message: error.message });
        throw error;
      }
    }),
  login: publicProcedure
    .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.getLocalCredentialByEmail(normalizeEmail(input.email));
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
      await issueAppSession(ctx.req, ctx.res, user.id);
      return { success: true, user } as const;
    }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await revokeRequestSession(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
