import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, portalResourceProcedure, protectedProcedure, router } from "../_core/trpc";
import { synchronizeDelegatedEntraGroupMemberships } from "../integrations/microsoftGraph";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.").min(2).max(100);
const assignmentInput = z.discriminatedUnion("subjectType", [
  z.object({ subjectType: z.literal("user"), userId: z.number().int().positive() }),
  z.object({ subjectType: z.literal("entra_group"), entraGroupId: z.string().trim().min(1).max(128), displayName: z.string().trim().min(1).max(240) }),
]);

const resourceInput = z.object({
  id: z.number().int().positive().optional(),
  resourceType: z.enum(["module", "page"]),
  resourceKey: z.string().trim().min(1).max(140).optional(),
  slug: slug.optional(),
  label: z.string().trim().min(2).max(160),
  navigationGroup: z.string().trim().min(2).max(120),
  iconKey: z.string().trim().regex(/^[a-z0-9-]+$/).min(2).max(64),
  body: z.string().trim().max(20_000).nullable().optional(),
  accessMode: z.enum(["all_authenticated", "restricted"]),
  isPublished: z.boolean(),
  sortOrder: z.number().int().min(-10_000).max(10_000),
  assignments: z.array(assignmentInput).max(100),
});
const accessRequestInput = z.object({ resourceKey: z.string().trim().min(1).max(140), note: z.string().trim().max(500).optional() });

function customPagePath(input: z.infer<typeof resourceInput>) {
  if (!input.slug) throw new TRPCError({ code: "BAD_REQUEST", message: "A page slug is required for custom pages." });
  return `/pages/${input.slug}`;
}

export const portalAccessRouter = router({
  navigation: protectedProcedure.query(async ({ ctx }) => ({
    resources: await db.listVisiblePortalResources({ userId: ctx.user.id, role: ctx.user.role }),
  })),

  myEntraGroups: protectedProcedure.query(async ({ ctx }) => ({
    groups: await db.listUserEntraGroupMemberships(ctx.user.id),
  })),

  refreshMyEntraGroups: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await synchronizeDelegatedEntraGroupMemberships(ctx.user.id);
      await db.appendAccessControlAuditEvent({ action: "entra_memberships_refreshed", actorUserId: ctx.user.id, metadataJson: JSON.stringify({ synchronized: result.synchronized }) });
      return result;
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Entra group synchronization is unavailable." });
    }
  }),

  businessManagement: portalResourceProcedure("module:business-management").query(async () => {
    const resource = await db.getPortalResourceByKey("module:business-management");
    if (!resource) throw new TRPCError({ code: "NOT_FOUND", message: "Business Management is not available." });
    return resource;
  }),

  customPage: protectedProcedure.input(z.object({ slug })).query(async ({ ctx, input }) => {
    const resource = await db.getPortalResourceByPath(`/pages/${input.slug}`);
    if (!resource || resource.resourceType !== "page" || !resource.isPublished) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
    }
    if (!(await db.canAccessPortalResource({ resourceKey: resource.resourceKey, userId: ctx.user.id, role: ctx.user.role }))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this page." });
    }
    return resource;
  }),

  requestAccess: protectedProcedure.input(accessRequestInput).mutation(async ({ ctx, input }) => {
    const resource = await db.getPortalResourceByKey(input.resourceKey);
    if (!resource || !resource.isPublished || resource.accessMode !== "restricted") throw new TRPCError({ code: "BAD_REQUEST", message: "This page does not accept access requests." });
    if (await db.canAccessPortalResource({ resourceKey: resource.resourceKey, userId: ctx.user.id, role: ctx.user.role })) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have access to this page." });
    const result = await db.createPortalAccessRequest({ resourceId: resource.id, requesterUserId: ctx.user.id, note: input.note });
    return { created: result.created };
  }),

  adminNotifications: adminProcedure.query(async ({ ctx }) => ({
    unreadCount: await db.getUnreadAdminAccessRequestNotificationCount(ctx.user.id),
    notifications: await db.listAdminAccessRequestNotifications(ctx.user.id),
  })),

  markAdminNotificationsRead: adminProcedure.mutation(async ({ ctx }) => {
    await db.markAdminAccessRequestNotificationsRead(ctx.user.id);
    return { success: true } as const;
  }),

  adminOverview: adminProcedure.query(async () => ({
    resources: await db.listPortalResources(true),
    groups: await db.listEntraGroups(),
    users: await db.listPortalUsersForAssignments(),
    auditEvents: await db.listAccessControlAuditEvents(100),
    accessRequests: await db.listPortalAccessRequests(200),
  })),

  reviewAccessRequest: adminProcedure.input(z.object({ requestId: z.number().int().positive(), status: z.enum(["approved", "declined"]) })).mutation(async ({ ctx, input }) => {
    return db.reviewPortalAccessRequest({ requestId: input.requestId, reviewerUserId: ctx.user.id, status: input.status });
  }),

  adminAssignments: adminProcedure.input(z.object({ resourceId: z.number().int().positive() })).query(async ({ input }) => {
    return db.getPortalResourceAssignments(input.resourceId);
  }),

  saveResource: adminProcedure.input(resourceInput).mutation(async ({ ctx, input }) => {
    if (!input.id && input.resourceType !== "page") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "New portal resources must be custom pages; system modules are provisioned by the application." });
    }
    const resourceKey = input.resourceType === "page" ? `page:${input.slug}` : input.resourceKey;
    if (!resourceKey) throw new TRPCError({ code: "BAD_REQUEST", message: "A system module key is required." });
    const path = input.resourceType === "page" ? customPagePath(input) : undefined;
    const existing = input.id ? (await db.listPortalResources(true)).find(resource => resource.id === input.id) : undefined;
    if (input.id && !existing) throw new TRPCError({ code: "NOT_FOUND", message: "Portal resource not found." });
    if (existing?.isSystem && input.resourceType !== "module") throw new TRPCError({ code: "BAD_REQUEST", message: "System modules cannot be converted into pages." });
    if (input.accessMode === "restricted" && input.assignments.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Assign at least one user or Entra group to a restricted resource." });
    }
    for (const assignment of input.assignments) {
      if (assignment.subjectType === "entra_group") {
        await db.upsertEntraGroup({ groupId: assignment.entraGroupId, displayName: assignment.displayName });
      }
    }
    const resource = await db.savePortalResource({
      id: input.id,
      resourceKey,
      resourceType: input.resourceType,
      label: input.label,
      path: path || existing?.path || "/",
      navigationGroup: input.navigationGroup,
      iconKey: input.iconKey,
      body: input.body ?? null,
      accessMode: input.accessMode,
      isPublished: input.isPublished,
      sortOrder: input.sortOrder,
      createdByUserId: ctx.user.id,
    });
    if (!resource) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Portal resource could not be saved." });
    await db.replacePortalResourceAssignments({
      resourceId: resource.id,
      assignments: input.assignments.map(assignment => assignment.subjectType === "user"
        ? { subjectType: "user" as const, userId: assignment.userId }
        : { subjectType: "entra_group" as const, entraGroupId: assignment.entraGroupId }),
      actorUserId: ctx.user.id,
    });
    await db.appendAccessControlAuditEvent({
      action: existing ? "portal_resource_updated" : "portal_resource_created",
      resourceId: resource.id,
      actorUserId: ctx.user.id,
      metadataJson: JSON.stringify({ resourceType: resource.resourceType, resourceKey: resource.resourceKey, accessMode: resource.accessMode, assignmentCount: input.assignments.length }),
    });
    return resource;
  }),

  deleteCustomResource: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const resource = (await db.listPortalResources(true)).find(item => item.id === input.id);
    if (!resource) throw new TRPCError({ code: "NOT_FOUND", message: "Portal resource not found." });
    await db.deleteCustomPortalResource(input.id);
    await db.appendAccessControlAuditEvent({ action: "portal_resource_deleted", actorUserId: ctx.user.id, metadataJson: JSON.stringify({ resourceKey: resource.resourceKey }) });
    return { success: true } as const;
  }),
});
