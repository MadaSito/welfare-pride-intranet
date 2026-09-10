import * as db from "../db";
import { getMicrosoftApplicationToken } from "./microsoftGraph";

type MailSettings = { senderMailbox?: string; bccEmail?: string };

function sanitizeProviderMessage(value: string) {
  return value.replace(/(token|secret|password|authorization)=?[^\s&]*/gi, "$1=[redacted]").slice(0, 1000);
}

export async function sendMicrosoftGraphMail(input: { subject: string; bodyText: string; recipients: string[]; bccEmail?: string | null }) {
  const settings = await db.getIntegrationSettingByProvider("microsoft_graph_mail");
  const config = settings?.publicConfigJson ? JSON.parse(settings.publicConfigJson) as MailSettings : {};
  const senderMailbox = config.senderMailbox?.trim();
  const bccEmail = input.bccEmail?.trim() || config.bccEmail?.trim();
  if (!senderMailbox) return { status: "unconfigured" as const, message: "Microsoft Graph Mail sender mailbox is not configured." };
  if (!input.recipients.length) return { status: "failed" as const, message: "No valid recipient email addresses were supplied." };
  try {
    const { accessToken, publicConfig } = await getMicrosoftApplicationToken();
    const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
    const response = await fetch(`${graphBaseUrl}/users/${encodeURIComponent(senderMailbox)}/sendMail`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "Text", content: input.bodyText },
          toRecipients: input.recipients.map(address => ({ emailAddress: { address } })),
          ...(bccEmail ? { bccRecipients: [{ emailAddress: { address: bccEmail } }] } : {}),
        },
        saveToSentItems: true,
      }),
    });
    if (!response.ok) return { status: "failed" as const, message: `Microsoft Graph accepted no message: HTTP ${response.status}. ${sanitizeProviderMessage(await response.text())}` };
    return { status: "sent" as const, message: "Microsoft Graph accepted the message for delivery (HTTP 202)." };
  } catch (error) {
    return { status: "failed" as const, message: sanitizeProviderMessage(error instanceof Error ? error.message : "Microsoft Graph mail delivery failed.") };
  }
}
