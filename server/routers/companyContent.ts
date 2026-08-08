import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import * as db from "../db";
import { synchronizeSharePointHolidays } from "../integrations/sharePoint";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const announcementInput = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().max(1000).nullable().optional(),
  body: z.string().trim().min(1).max(30_000),
  category: z.string().trim().min(1).max(100),
  status: z.enum(["draft", "published", "archived"]),
  isPinned: z.boolean().default(false),
  publishAt: z.date().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
});

const eventInput = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(10_000).nullable().optional(),
  category: z.string().trim().min(1).max(100),
  location: z.string().trim().max(240).nullable().optional(),
  meetingUrl: z.string().url().nullable().optional(),
  startAt: z.date(),
  endAt: z.date(),
  isAllDay: z.boolean().default(false),
  status: z.enum(["draft", "published", "cancelled", "archived"]),
}).refine(value => value.endAt >= value.startAt, { message: "Event end time must be after its start time.", path: ["endAt"] });

export const announcementsRouter = router({
  list: protectedProcedure.query(() => db.listPublishedAnnouncements()),
  adminList: adminProcedure.query(() => db.listAllAnnouncements()),
  create: adminProcedure.input(announcementInput).mutation(async ({ ctx, input }) => {
    const id = await db.createAnnouncement({
      ...input,
      slug: `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 220) || "announcement"}-${nanoid(6).toLowerCase()}`,
      authorUserId: ctx.user.id,
      publishAt: input.status === "published" ? (input.publishAt || new Date()) : input.publishAt,
    });
    return { id };
  }),
  update: adminProcedure.input(z.object({ id: z.number().int().positive(), values: announcementInput })).mutation(async ({ input }) => {
    await db.updateAnnouncement(input.id, {
      ...input.values,
      publishAt: input.values.status === "published" ? (input.values.publishAt || new Date()) : input.values.publishAt,
    });
    return { success: true } as const;
  }),
  archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.updateAnnouncement(input.id, { status: "archived" });
    return { success: true } as const;
  }),
});

export const eventsRouter = router({
  list: protectedProcedure.input(z.object({ from: z.date(), to: z.date() })).query(({ input }) => db.listPublishedEvents(input.from, input.to)),
  adminList: adminProcedure.query(() => db.listAllEvents()),
  create: adminProcedure.input(eventInput).mutation(async ({ ctx, input }) => {
    const id = await db.createCompanyEvent({ ...input, authorUserId: ctx.user.id });
    return { id };
  }),
  update: adminProcedure.input(z.object({ id: z.number().int().positive(), values: eventInput })).mutation(async ({ input }) => {
    await db.updateCompanyEvent(input.id, input.values);
    return { success: true } as const;
  }),
  cancel: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.updateCompanyEvent(input.id, { status: "cancelled" });
    return { success: true } as const;
  }),
});

export const calendarsRouter = router({
  overview: protectedProcedure
    .input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const [holidayItems, birthdays, eventItems, sharePointConfig] = await Promise.all([
        db.listHolidays(input.from, input.to),
        db.listBirthdayDisplays(),
        db.listPublishedEvents(new Date(`${input.from}T00:00:00.000Z`), new Date(`${input.to}T23:59:59.999Z`)),
        db.getIntegrationSettingByProvider("sharepoint"),
      ]);
      return {
        status: sharePointConfig ? sharePointConfig.status : "unconfigured",
        message: sharePointConfig ? undefined : "Connect SharePoint to synchronize the Welfare Pride holiday list.",
        holidays: holidayItems,
        birthdays,
        events: eventItems,
      };
    }),
  syncHolidays: adminProcedure.mutation(async () => {
    try {
      return await synchronizeSharePointHolidays();
    } catch (error) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "SharePoint holiday synchronization failed.",
      });
    }
  }),
});
