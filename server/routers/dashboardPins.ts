import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { getAuthorizedSharePointDocument } from "../integrations/sharePoint";
import { protectedProcedure, router } from "../_core/trpc";

const pinType = z.enum(["hr_document", "event"]);

async function assertPinCapacity(userId: number, type: "hr_document" | "event", targetKey: string) {
  const pins = await db.listDashboardPinsForUser(userId);
  if (pins.some(pin => pin.pinType === type && pin.targetKey === targetKey)) return;
  if (pins.filter(pin => pin.pinType === type).length >= 12) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `You can pin up to 12 ${type === "event" ? "events" : "HR resources"}. Remove one before adding another.` });
  }
}

export const dashboardPinsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const pins = await db.listDashboardPinsForUser(ctx.user.id);
    const eventPins = pins.filter(pin => pin.pinType === "event");
    const documentPins = pins.filter(pin => pin.pinType === "hr_document");
    const events = (await Promise.all(eventPins.map(async pin => {
      const eventId = Number(pin.targetKey);
      const event = Number.isInteger(eventId) ? await db.getPublishedUpcomingEventById(eventId) : undefined;
      return event ? { pinId: pin.id, ...event } : null;
    }))).filter(item => item !== null);
    const documents = (await Promise.all(documentPins.map(async pin => {
      try {
        const document = await getAuthorizedSharePointDocument({ userId: ctx.user.id, documentId: pin.targetKey });
        return document && !document.isFolder ? { pinId: pin.id, ...document } : null;
      } catch {
        return null;
      }
    }))).filter(item => item !== null);
    return {
      events,
      documents,
      pinnedEventIds: eventPins.map(pin => Number(pin.targetKey)).filter(Number.isInteger),
      pinnedDocumentIds: documentPins.map(pin => pin.targetKey),
      unavailableCount: eventPins.length + documentPins.length - events.length - documents.length,
    };
  }),
  pinEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const event = await db.getPublishedUpcomingEventById(input.eventId);
    if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Only published upcoming events can be pinned." });
    await assertPinCapacity(ctx.user.id, "event", String(event.id));
    await db.addDashboardPinForUser(ctx.user.id, "event", String(event.id));
    return { success: true } as const;
  }),
  pinDocument: protectedProcedure.input(z.object({ documentId: z.string().trim().min(1).max(255) })).mutation(async ({ ctx, input }) => {
    const document = await getAuthorizedSharePointDocument({ userId: ctx.user.id, documentId: input.documentId });
    if (!document || document.isFolder) throw new TRPCError({ code: "NOT_FOUND", message: "This HR document is unavailable or you do not have access." });
    await assertPinCapacity(ctx.user.id, "hr_document", document.id);
    await db.addDashboardPinForUser(ctx.user.id, "hr_document", document.id);
    return { success: true } as const;
  }),
  remove: protectedProcedure.input(z.object({ pinType, targetKey: z.string().trim().min(1).max(255) })).mutation(async ({ ctx, input }) => {
    await db.removeDashboardPinForUser(ctx.user.id, input.pinType, input.targetKey);
    return { success: true } as const;
  }),
});
