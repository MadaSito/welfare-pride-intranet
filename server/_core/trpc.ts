import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as db from "../db";
import type { PortalPermission } from "../../shared/roles";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.authState && ctx.authState !== "full") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Complete the required local account security step before accessing the portal." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export function portalResourceProcedure(resourceKey: string) {
  return protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      if (!ctx.user || !(await db.canAccessPortalResource({ resourceKey, userId: ctx.user.id, role: ctx.user.role }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this portal resource." });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    }),
  );
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.authState && ctx.authState !== "full") || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export function permissionProcedure(permission: PortalPermission) {
  return protectedProcedure.use(t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || (ctx.user.role !== "admin" && !(await db.userHasPortalPermission(ctx.user.id, permission)))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Your portal role does not include this permission." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }));
}
