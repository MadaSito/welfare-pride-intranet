import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest, type AuthenticatedSession, type LocalAuthState } from "../auth/session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authState: LocalAuthState | null;
  session: AuthenticatedSession | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let session: AuthenticatedSession | null = null;

  try {
    session = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    session = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user: session?.user ?? null,
    authState: session?.authState ?? null,
    session,
  };
}
