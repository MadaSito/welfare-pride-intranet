import { TRPCError } from "@trpc/server";
import { isIP } from "node:net";
import { z } from "zod";
import * as db from "../db";
import { listAuthorizedSharePointDocuments } from "../integrations/sharePoint";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

function isPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".local")) return true;
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return isIP(normalized) === 6 && (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80"));
}

export function validateTechnologyEmbed(urlValue: string, allowedHostnameValue: string) {
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Technology embed URL is invalid." });
  }
  const allowedHostname = allowedHostnameValue.trim().toLowerCase();
  if (parsed.protocol !== "https:") throw new TRPCError({ code: "BAD_REQUEST", message: "Technology embeds must use HTTPS." });
  if (!allowedHostname || parsed.hostname.toLowerCase() !== allowedHostname) throw new TRPCError({ code: "BAD_REQUEST", message: "The URL hostname must exactly match the approved hostname." });
  if (isPrivateHost(allowedHostname)) throw new TRPCError({ code: "BAD_REQUEST", message: "Private and local network hosts cannot be embedded." });
  parsed.username = "";
  parsed.password = "";
  return { url: parsed.toString(), allowedHostname };
}

export const documentsRouter = router({
  list: protectedProcedure
    .input(z.object({ query: z.string().trim().max(200).optional(), category: z.string().trim().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      const setting = await db.getIntegrationSettingByProvider("sharepoint");
      if (!setting) return { status: "unconfigured" as const, message: "Connect SharePoint and configure the HR document library.", items: [] };
      try {
        const items = await listAuthorizedSharePointDocuments({ userId: ctx.user.id, ...input });
        return { status: "connected" as const, message: undefined, items };
      } catch (error) {
        return { status: "degraded" as const, message: error instanceof Error ? error.message : "SharePoint documents could not be loaded.", items: [] };
      }
    }),
});

const technologyInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  url: z.string().trim().url(),
  allowedHostname: z.string().trim().min(1).max(253),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export const technologyRouter = router({
  list: protectedProcedure.query(() => db.listActiveTechnologyEmbeds()),
  adminList: adminProcedure.query(() => db.listAllTechnologyEmbeds()),
  create: adminProcedure.input(technologyInput).mutation(async ({ ctx, input }) => {
    const validated = validateTechnologyEmbed(input.url, input.allowedHostname);
    const id = await db.createTechnologyEmbed({ ...input, ...validated, createdByUserId: ctx.user.id });
    return { id };
  }),
  update: adminProcedure.input(z.object({ id: z.number().int().positive(), values: technologyInput })).mutation(async ({ input }) => {
    const validated = validateTechnologyEmbed(input.values.url, input.values.allowedHostname);
    await db.updateTechnologyEmbed(input.id, { ...input.values, ...validated });
    return { success: true } as const;
  }),
  setActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input }) => {
    await db.updateTechnologyEmbed(input.id, { isActive: input.isActive });
    return { success: true } as const;
  }),
});
