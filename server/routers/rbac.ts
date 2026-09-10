import { z } from "zod";
import * as db from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { PORTAL_PERMISSIONS } from "../../shared/roles";

const permission = z.enum(PORTAL_PERMISSIONS);

export const rbacRouter = router({
  overview: adminProcedure.query(async () => ({ roles: await db.listPortalRoles(), assignments: await db.listPortalRoleAssignments(), users: await db.listPortalUsersForAssignments() })),
  saveRole: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(3).max(120), description: z.string().trim().max(2000).nullable().optional(), permissions: z.array(permission).min(1).max(PORTAL_PERMISSIONS.length) })).mutation(async ({ ctx, input }) => { const role = await db.savePortalRole({ ...input, actorUserId: ctx.user.id }); await db.appendOperationAuditEvent({ entityType: "portal_role", entityId: role.id, eventType: input.id ? "updated" : "created", status: "succeeded", message: `${input.id ? "Updated" : "Created"} portal role: ${role.name}.`, metadataJson: JSON.stringify({ permissions: input.permissions }), actorUserId: ctx.user.id }); return role; }),
  setUserRoles: adminProcedure.input(z.object({ userId: z.number().int().positive(), roleIds: z.array(z.number().int().positive()).max(30) })).mutation(async ({ ctx, input }) => { await db.replaceUserPortalRoles({ ...input, actorUserId: ctx.user.id }); await db.appendOperationAuditEvent({ entityType: "portal_user_role", entityId: input.userId, eventType: "assignments_updated", status: "succeeded", message: "Portal role assignments updated for a user.", metadataJson: JSON.stringify({ roleIds: input.roleIds }), actorUserId: ctx.user.id }); return { success: true } as const; }),
  myPermissions: protectedProcedure.query(async ({ ctx }) => ({ isAdministrator: ctx.user.role === "admin", permissions: await db.getUserPortalPermissions(ctx.user.id) })),
});
