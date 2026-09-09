import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { AppSession, User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { getTrustedClientIp } from "../security/securityCenter";

export const APP_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function requestToken(req: Request) {
  const parsed = parseCookieHeader(req.headers.cookie || "");
  return parsed[COOKIE_NAME] || null;
}

function fingerprint(value: string | undefined) {
  return value ? createHash("sha256").update(value).digest("hex") : null;
}

export type LocalAuthState = AppSession["authState"];

export type AuthenticatedSession = {
  user: User;
  authState: LocalAuthState;
  sessionId: number;
};

export async function issueAppSession(req: Request, res: Response, userId: number, authState: LocalAuthState = "full") {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + APP_SESSION_MAX_AGE_MS);
  const clientIp = getTrustedClientIp(req);
  await db.createAppSessionRecord({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    authState,
    userAgentHash: fingerprint(req.headers["user-agent"]),
    ipHash: fingerprint(clientIp),
  });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: APP_SESSION_MAX_AGE_MS });
  return expiresAt;
}

export async function revokeRequestSession(req: Request) {
  const token = requestToken(req);
  if (token) await db.revokeAppSession(hashSessionToken(token));
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedSession> {
  const token = requestToken(req);
  if (!token) throw ForbiddenError("Missing application session");
  const result = await db.getActiveAppSession(hashSessionToken(token));
  if (!result) throw ForbiddenError("Invalid or expired application session");
  void db.touchAppSession(result.session.id);
  return { user: result.user, authState: result.session.authState, sessionId: result.session.id };
}
