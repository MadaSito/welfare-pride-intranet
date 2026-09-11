import * as db from "../db";
import { sendMicrosoftGraphMail } from "../integrations/microsoftGraphMail";
import { getBirthdayDispatchDate } from "./birthdaySchedule";
import { getBirthdayTemplateValues, renderBirthdayTemplate } from "./birthdayTemplate";

export async function dispatchBirthdayCongratulations(now = new Date(), timeZone = "UTC") {
  const templates = (await db.listEmailTemplates()).filter(template => template.isActive && template.eventType === "birthday_congratulation").slice(0, 1);
  if (!templates.length) return { status: "no-active-template" as const, processed: 0, sent: 0 };
  const dispatchDate = getBirthdayDispatchDate(now, timeZone);
  const recipients = await db.listBirthdayEmailRecipients(dispatchDate.month, dispatchDate.day);
  let sent = 0;
  for (const recipient of recipients) {
    const template = templates[0];
    const deliveryKey = `birthday:${template.id}:${recipient.id}:${dispatchDate.year}`;
    if (await db.getEmailDeliveryByKey(deliveryKey)) continue;
    const values = getBirthdayTemplateValues(recipient.displayName);
    const delivery = await db.createEmailDelivery({ templateId: template.id, eventType: "birthday_congratulation", subject: renderBirthdayTemplate(template.subjectTemplate, values), bodyText: renderBirthdayTemplate(template.bodyTemplate, values), recipientsJson: JSON.stringify([recipient.email]), status: "queued", deliveryKey, triggeredByUserId: null });
    if (!delivery) continue;
    const result = await sendMicrosoftGraphMail({ subject: delivery.subject, bodyText: delivery.bodyText, recipients: [recipient.email] });
    await db.updateEmailDelivery(delivery.id, { status: result.status, providerMessage: result.message, ...(result.status === "sent" ? { sentAt: new Date() } : {}) });
    await db.appendOperationAuditEvent({ entityType: "email_delivery", entityId: delivery.id, eventType: `birthday_email_${result.status}`, status: result.status, message: result.message, metadataJson: JSON.stringify({ templateId: template.id, recipientProfileId: recipient.id }), actorUserId: null });
    if (result.status === "sent") sent += 1;
  }
  return { status: "completed" as const, processed: recipients.length, sent };
}
