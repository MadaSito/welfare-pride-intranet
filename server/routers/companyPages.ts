import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { storagePut } from "../storage";
import * as db from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const linkInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  url: z.string().trim().url(),
  category: z.string().trim().min(1).max(100),
  iconKey: z.string().trim().min(1).max(64),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
});

export const linksRouter = router({
  list: protectedProcedure.query(() => db.listActiveImportantLinks()),
  adminList: adminProcedure.query(() => db.listAllImportantLinks()),
  create: adminProcedure.input(linkInput).mutation(async ({ ctx, input }) => ({ id: await db.createImportantLink({ ...input, createdByUserId: ctx.user.id }) })),
  update: adminProcedure.input(z.object({ id: z.number().int().positive(), values: linkInput })).mutation(async ({ input }) => { await db.updateImportantLink(input.id, input.values); return { success: true } as const; }),
  setActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input }) => { await db.updateImportantLink(input.id, { isActive: input.isActive }); return { success: true } as const; }),
});

const blockInput = z.object({
  pageKey: z.enum(["about"]),
  sectionKey: z.string().trim().min(1).max(120),
  eyebrow: z.string().trim().max(160).nullable().optional(),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(20_000),
  mediaUrl: z.string().trim().url().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000),
  isPublished: z.boolean(),
});

const founderInput = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).nullable().optional(),
  bio: z.string().trim().min(1).max(10_000),
  photoUrl: z.string().trim().url().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000),
  isPublished: z.boolean(),
});

const milestoneInput = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(4000),
  eventDate: z.date(),
  sortOrder: z.number().int().min(0).max(10_000),
  isPublished: z.boolean(),
});

export const companyPagesRouter = router({
  about: protectedProcedure.query(() => db.listPublishedContentBlocks("about")),
  adminAbout: adminProcedure.query(() => db.listAllContentBlocks("about")),
  saveBlock: adminProcedure.input(blockInput).mutation(async ({ ctx, input }) => { await db.upsertContentBlock({ ...input, updatedByUserId: ctx.user.id }); return { success: true } as const; }),
  founders: protectedProcedure.query(async () => ({ people: await db.listPublishedFounders(), milestones: await db.listPublishedMilestones() })),
  adminFounders: adminProcedure.query(async () => ({ people: await db.listAllFounders(), milestones: await db.listAllMilestones() })),
  createFounder: adminProcedure.input(founderInput).mutation(async ({ input }) => ({ id: await db.createFounder(input) })),
  updateFounder: adminProcedure.input(z.object({ id: z.number().int().positive(), values: founderInput })).mutation(async ({ input }) => { await db.updateFounder(input.id, input.values); return { success: true } as const; }),
  createMilestone: adminProcedure.input(milestoneInput).mutation(async ({ input }) => ({ id: await db.createMilestone(input) })),
  updateMilestone: adminProcedure.input(z.object({ id: z.number().int().positive(), values: milestoneInput })).mutation(async ({ input }) => { await db.updateMilestone(input.id, input.values); return { success: true } as const; }),
  uploadImage: adminProcedure.input(z.object({ dataUrl: z.string().max(5_500_000), context: z.enum(["founder", "about"]) })).mutation(async ({ input }) => {
    const match = input.dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Use a PNG, JPEG, or WebP image." });
    const body = Buffer.from(match[2], "base64");
    if (body.byteLength > 4_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Images must be 4 MB or smaller." });
    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    return storagePut(`company-content/${input.context}/${Date.now()}-${nanoid(8)}.${extension}`, body, `image/${match[1]}`);
  }),
});
