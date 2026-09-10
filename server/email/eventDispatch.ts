import * as db from "../db";
import { sendMicrosoftGraphMail } from "../integrations/microsoftGraphMail";

type EventType = "announcement_published" | "event_published";

function render(value: string, data: { title: string; summary: string }) {
  return value.replace(/\{\{title\}\}/g, data.title).replace(/\{\{summary\}\}/g, data.summary);
}

export async function dispatchConfiguredEventEmails(input: { eventType: EventType; title: string; summary: string; actorUserId: number; entityType: "announcement" | "event"; entityId: number }) {
  const templates = (await db.listEmailTemplates()).filter(template => template.isActive && template.eventType === input.eventType);
  const recipients = await db.listActiveEmployeeEmailAddresses();
  const results: Array<{ deliveryId: number; status: string }> = [];
  for (const template of templates) {
    const delivery = await db.createEmailDelivery({ templateId: template.id, eventType: input.eventType, subject: render(template.subjectTemplate, input), bodyText: render(template.bodyTemplate, input), recipientsJson: JSON.stringify(recipients), status: "queued", triggeredByUserId: input.actorUserId });
    if (!delivery) continue;
    const result = await sendMicrosoftGraphMail({ subject: delivery.subject, bodyText: delivery.bodyText, recipients });
    await db.updateEmailDelivery(delivery.id, { status: result.status, providerMessage: result.message, ...(result.status === "sent" ? { sentAt: new Date() } : {}) });
    await db.appendOperationAuditEvent({ entityType: "email_delivery", entityId: delivery.id, eventType: `event_email_${result.status}`, status: result.status, message: result.message, metadataJson: JSON.stringify({ sourceEntityType: input.entityType, sourceEntityId: input.entityId, templateId: template.id, recipientCount: recipients.length }), actorUserId: input.actorUserId });
    results.push({ deliveryId: delivery.id, status: result.status });
  }
  return results;
}
