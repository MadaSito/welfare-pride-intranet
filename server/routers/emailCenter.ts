import { z } from "zod";
import * as db from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { sendMicrosoftGraphMail } from "../integrations/microsoftGraphMail";

const eventType = z.enum(["announcement_published", "event_published", "birthday_congratulation", "manual"]);
const emailAddress = z.string().trim().email().max(320);
const templateInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(160),
  eventType,
  subjectTemplate: z.string().trim().min(1).max(500),
  bodyTemplate: z.string().trim().min(1).max(40_000),
  isActive: z.boolean(),
});

function normalizeRecipients(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim().toLowerCase()).filter(item => z.string().email().safeParse(item).success))).slice(0, 200);
}

async function deliver(input: { templateId?: number | null; eventType: "announcement_published" | "event_published" | "birthday_congratulation" | "manual"; subject: string; bodyText: string; recipients: string[]; bccEmail?: string | null; actorUserId: number; sourceDeliveryId?: number | null }) {
  const recipients = normalizeRecipients(input.recipients);
  const delivery = await db.createEmailDelivery({ templateId: input.templateId ?? null, eventType: input.eventType, subject: input.subject, bodyText: input.bodyText, recipientsJson: JSON.stringify(recipients), bccEmail: input.bccEmail || null, status: "queued", triggeredByUserId: input.actorUserId, sourceDeliveryId: input.sourceDeliveryId ?? null });
  if (!delivery) throw new Error("Email delivery record could not be created.");
  const result = await sendMicrosoftGraphMail({ subject: input.subject, bodyText: input.bodyText, recipients, bccEmail: input.bccEmail });
  await db.updateEmailDelivery(delivery.id, { status: result.status, providerMessage: result.message, ...(result.status === "sent" ? { sentAt: new Date() } : {}) });
  await db.appendOperationAuditEvent({ entityType: "email_delivery", entityId: delivery.id, eventType: `email_${result.status}`, status: result.status === "sent" ? "succeeded" : result.status, message: result.message, metadataJson: JSON.stringify({ eventType: input.eventType, recipientCount: recipients.length, templateId: input.templateId ?? null, sourceDeliveryId: input.sourceDeliveryId ?? null }), actorUserId: input.actorUserId });
  return { ...(await db.getEmailDeliveryById(delivery.id))!, result };
}

export const emailCenterRouter = router({
  overview: permissionProcedure("manage_email").query(async () => ({ templates: await db.listEmailTemplates(), deliveries: await db.listEmailDeliveries(150), graphMail: await db.getIntegrationSettingByProvider("microsoft_graph_mail") })),
  saveTemplate: permissionProcedure("manage_email").input(templateInput).mutation(async ({ ctx, input }) => {
    const template = await db.saveEmailTemplate({ ...input, actorUserId: ctx.user.id });
    if (!template) throw new Error("Email template could not be saved.");
    await db.appendOperationAuditEvent({ entityType: "email_template", entityId: template.id, eventType: "template_saved", status: "succeeded", message: `Email template ${input.name} saved.`, metadataJson: JSON.stringify({ eventType: input.eventType, active: input.isActive }), actorUserId: ctx.user.id });
    return template;
  }),
  sendManual: permissionProcedure("manage_email").input(z.object({ templateId: z.number().int().positive().optional(), subject: z.string().trim().min(1).max(500), bodyText: z.string().trim().min(1).max(40_000), recipients: z.array(emailAddress).min(1).max(200), bccEmail: emailAddress.optional() })).mutation(async ({ ctx, input }) => deliver({ templateId: input.templateId ?? null, eventType: "manual", subject: input.subject, bodyText: input.bodyText, recipients: input.recipients, bccEmail: input.bccEmail || null, actorUserId: ctx.user.id })),
  resend: permissionProcedure("manage_email").input(z.object({ deliveryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const source = await db.getEmailDeliveryById(input.deliveryId);
    if (!source) throw new Error("Email delivery record not found.");
    let recipients: string[] = [];
    try { recipients = JSON.parse(source.recipientsJson) as string[]; } catch { throw new Error("Stored recipients could not be read safely."); }
    return deliver({ templateId: source.templateId, eventType: source.eventType as "announcement_published" | "event_published" | "birthday_congratulation" | "manual", subject: source.subject, bodyText: source.bodyText, recipients, bccEmail: source.bccEmail, actorUserId: ctx.user.id, sourceDeliveryId: source.id });
  }),
});
