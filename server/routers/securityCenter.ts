import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { CORRELATION_ID_HEADER, getTrustedClientIp, normalizeClientIp } from "../security/securityCenter";

const severity = z.enum(["info", "low", "medium", "high", "critical"]);
const securitySettingsSchema = z.object({
  allowlistEnabled: z.boolean(),
  rateLimitRequests: z.number().int().min(20).max(10_000),
  rateLimitWindowSeconds: z.number().int().min(10).max(3_600),
  autoBlockThreshold: z.number().int().min(0).max(100),
  autoBlockDurationMinutes: z.number().int().min(5).max(43_200),
});
const ipAddress = z.string().trim().max(45).refine(value => normalizeClientIp(value) !== "unknown", "Enter a valid IPv4 or IPv6 address.");

function correlationId(ctx: { res: { getHeader: (name: string) => number | string | string[] | undefined } }) {
  const header = ctx.res.getHeader(CORRELATION_ID_HEADER);
  return typeof header === "string" && header ? header : "security-center-action";
}

async function appendAdministratorSecurityEvent(input: {
  ctx: { req: Request; res: { getHeader: (name: string) => number | string | string[] | undefined }; user: { id: number } };
  eventType: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
}) {
  await db.appendSecurityEvent({
    correlationId: correlationId(input.ctx),
    eventType: input.eventType,
    severity: input.severity,
    ipAddress: getTrustedClientIp(input.ctx.req),
    method: input.ctx.req.method.slice(0, 12),
    requestPath: input.ctx.req.path.slice(0, 240),
    actorUserId: input.ctx.user.id,
    detailsJson: JSON.stringify(input.details),
  });
}

export const securityCenterRouter = router({
  overview: adminProcedure.query(async ({ ctx }) => ({
    ...(await db.getSecurityOverview()),
    currentIpAddress: getTrustedClientIp(ctx.req),
  })),

  events: adminProcedure.input(z.object({
    correlationId: z.string().trim().max(64).optional(),
    ipAddress: ipAddress.optional(),
    severity: severity.optional(),
    eventType: z.string().trim().max(120).optional(),
    search: z.string().trim().max(100).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })).query(({ input }) => db.listSecurityEvents(input)),

  saveSettings: adminProcedure.input(securitySettingsSchema).mutation(async ({ ctx, input }) => {
    const currentIpAddress = getTrustedClientIp(ctx.req);
    if (input.allowlistEnabled) {
      const activePolicies = await db.listActiveSecurityIpPolicies();
      if (!activePolicies.some(policy => policy.mode === "allow" && policy.ipAddress === currentIpAddress)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add an active allow policy for your current IP address before enabling allowlist-only mode." });
      }
    }
    const previous = await db.getSecuritySettings();
    const settings = await db.updateSecuritySettings({ ...input, updatedByUserId: ctx.user.id });
    await appendAdministratorSecurityEvent({
      ctx,
      eventType: "security_settings_updated",
      severity: "low",
      details: { previous: { ...db.DEFAULT_SECURITY_SETTINGS, ...previous }, current: input },
    });
    return settings;
  }),

  saveIpPolicy: adminProcedure.input(z.object({
    mode: z.enum(["allow", "block"]),
    ipAddress,
    label: z.string().trim().min(2).max(160),
    expiresAt: z.coerce.date().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    const normalizedIp = normalizeClientIp(input.ipAddress);
    const currentIpAddress = getTrustedClientIp(ctx.req);
    if (input.mode === "block" && normalizedIp === currentIpAddress) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "For safety, you cannot block the IP address of your current administrator session." });
    }
    if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A temporary policy must expire in the future." });
    }
    const policy = await db.upsertSecurityIpPolicy({
      mode: input.mode,
      ipAddress: normalizedIp,
      label: input.label,
      expiresAt: input.expiresAt ?? null,
      createdByUserId: ctx.user.id,
    });
    await appendAdministratorSecurityEvent({
      ctx,
      eventType: input.mode === "block" ? "ip_block_policy_saved" : "ip_allow_policy_saved",
      severity: input.mode === "block" ? "medium" : "low",
      details: { policyId: policy?.id, mode: input.mode, ipAddress: normalizedIp, label: input.label, expiresAt: input.expiresAt?.toISOString() ?? null },
    });
    return policy;
  }),

  revokeIpPolicy: adminProcedure.input(z.object({ policyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const policy = await db.revokeSecurityIpPolicy({ policyId: input.policyId, revokedByUserId: ctx.user.id });
    if (!policy) throw new TRPCError({ code: "NOT_FOUND", message: "IP policy not found." });
    await appendAdministratorSecurityEvent({
      ctx,
      eventType: policy.mode === "block" ? "ip_block_policy_revoked" : "ip_allow_policy_revoked",
      severity: "low",
      details: { policyId: policy.id, mode: policy.mode, ipAddress: policy.ipAddress },
    });
    return policy;
  }),
});
