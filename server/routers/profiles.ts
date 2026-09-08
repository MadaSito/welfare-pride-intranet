import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { DirectoryNode } from "../../shared/domain";
import { storagePut } from "../storage";
import * as db from "../db";
import { fetchGraphDirectory, synchronizeGraphDirectory } from "../integrations/microsoftGraph";
import { adminProcedure, portalResourceProcedure, protectedProcedure, router } from "../_core/trpc";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

function toDirectoryNode(profile: Awaited<ReturnType<typeof db.listEmployeeProfiles>>[number]): DirectoryNode {
  return {
    id: profile.entraUserId || `profile:${profile.id}`,
    profileId: profile.id,
    displayName: profile.displayName,
    jobTitle: profile.jobTitle,
    department: profile.department,
    email: profile.email,
    phone: profile.phone,
    officeLocation: profile.officeLocation,
    photoUrl: profile.photoUrl,
    managerId: profile.managerEntraUserId,
  };
}

async function readDirectoryWithGraphFallback() {
  const [profiles, microsoftConfig] = await Promise.all([
    db.listEmployeeProfiles(),
    db.getIntegrationSettingByProvider("microsoft_entra"),
  ]);
  if (!microsoftConfig) {
    return {
      status: "unconfigured" as const,
      source: "portal" as const,
      message: "Connect Microsoft Entra ID to synchronize the Welfare Pride employee directory.",
      items: profiles.map(toDirectoryNode),
      synchronizedAt: null,
    };
  }

  try {
    const liveItems = await fetchGraphDirectory();
    const cachedByEntraId = new Map(
      profiles.filter(profile => profile.entraUserId).map(profile => [profile.entraUserId!, profile]),
    );
    return {
      status: "connected" as const,
      source: "microsoft_graph" as const,
      message: undefined,
      items: liveItems.map(item => {
        const cached = cachedByEntraId.get(item.id);
        return { ...item, profileId: cached?.id ?? null, photoUrl: cached?.photoUrl ?? null };
      }),
      synchronizedAt: new Date(),
    };
  } catch (error) {
    return {
      status: "degraded" as const,
      source: "microsoft_graph_cache" as const,
      message: `Live Microsoft Graph data is temporarily unavailable. Showing the last synchronized directory. ${error instanceof Error ? error.message : ""}`.trim(),
      items: profiles.map(toDirectoryNode),
      synchronizedAt: profiles.reduce<Date | null>((latest, profile) => {
        if (!profile.lastSyncedAt) return latest;
        return !latest || profile.lastSyncedAt > latest ? profile.lastSyncedAt : latest;
      }, null),
    };
  }
}

async function storeProfilePhoto(input: { profileId: number; ownerKey: string; dataUrl: string }) {
  const match = input.dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Use a PNG, JPEG, or WebP image." });
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const body = Buffer.from(match[2], "base64");
  if (body.byteLength > 4_000_000) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Profile photographs must be 4 MB or smaller." });
  }
  const uploaded = await storagePut(
    `employee-profiles/${input.ownerKey}/${Date.now()}-${nanoid(8)}.${extension}`,
    body,
    `image/${match[1]}`,
  );
  return db.updateEmployeeProfilePhoto(input.profileId, uploaded.url);
}

export const profilesRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return db.ensureEmployeeProfileForUser(ctx.user);
  }),

  list: portalResourceProcedure("module:people").query(async ({ ctx }) => {
    await db.ensureEmployeeProfileForUser(ctx.user);
    const directory = await readDirectoryWithGraphFallback();
    const profiles = await db.listEmployeeProfiles();
    const directoryById = new Map(directory.items.map(item => [item.id, item]));
    return {
      ...directory,
      items: profiles.map(profile => {
        const live = profile.entraUserId ? directoryById.get(profile.entraUserId) : undefined;
        return live
          ? {
              ...profile,
              displayName: live.displayName,
              jobTitle: live.jobTitle,
              department: live.department,
              email: live.email,
              phone: profile.phone || live.phone,
              officeLocation: live.officeLocation,
            }
          : profile;
      }),
    };
  }),

  organization: portalResourceProcedure("module:organization").query(async ({ ctx }) => {
    await db.ensureEmployeeProfileForUser(ctx.user);
    return readDirectoryWithGraphFallback();
  }),

  updateMe: protectedProcedure
    .input(z.object({ bio: optionalText(3000), phone: optionalText(64) }))
    .mutation(async ({ ctx, input }) => {
      await db.ensureEmployeeProfileForUser(ctx.user);
      return db.updateOwnEmployeeProfile(ctx.user.id, input);
    }),

  uploadMyPhoto: protectedProcedure
    .input(
      z.object({
        dataUrl: z.string().max(5_500_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await db.ensureEmployeeProfileForUser(ctx.user);
      if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Profile could not be created." });
      return storeProfilePhoto({ profileId: profile.id, ownerKey: String(ctx.user.id), dataUrl: input.dataUrl });
    }),

  adminUploadPhoto: adminProcedure
    .input(z.object({ profileId: z.number().int().positive(), dataUrl: z.string().max(5_500_000) }))
    .mutation(async ({ input }) => {
      const profile = await db.getEmployeeProfileById(input.profileId);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Employee profile not found." });
      return storeProfilePhoto({ profileId: profile.id, ownerKey: `admin-${profile.id}`, dataUrl: input.dataUrl });
    }),

  adminUpdate: adminProcedure
    .input(
      z.object({
        profileId: z.number().int().positive(),
        displayName: z.string().trim().min(1).max(200).optional(),
        jobTitle: optionalText(200),
        department: optionalText(200),
        officeLocation: optionalText(200),
        bio: optionalText(3000),
        phone: optionalText(64),
        managerEntraUserId: optionalText(128),
        birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
        birthdayDay: z.number().int().min(1).max(31).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { profileId, ...patch } = input;
      const updated = await db.updateEmployeeProfileAsAdmin(profileId, patch);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Employee profile not found." });
      return updated;
    }),

  syncDirectory: adminProcedure.mutation(async () => {
    try {
      return await synchronizeGraphDirectory();
    } catch (error) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "Microsoft Graph directory synchronization failed.",
      });
    }
  }),
});
