import { isIP } from "node:net";
import * as db from "../db";
import { decryptJson } from "../security/encryption";
import type { AiPublicConfig, AiSecrets } from "./contracts";

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return isIP(host) === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80"));
}

export function validateAiBaseUrl(value: string) {
  const parsed = new URL(value);
  const allowPrivate = process.env.AI_ALLOW_PRIVATE_ENDPOINTS === "true";
  if (parsed.protocol !== "https:" && !(allowPrivate && parsed.protocol === "http:")) throw new Error("AI endpoint must use HTTPS unless AI_ALLOW_PRIVATE_ENDPOINTS=true.");
  if (isPrivateHost(parsed.hostname) && !allowPrivate) throw new Error("Private AI endpoints require AI_ALLOW_PRIVATE_ENDPOINTS=true.");
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

async function loadAiConfiguration() {
  const setting = await db.getIntegrationSettingByProvider("ai_assistant");
  const publicConfig = setting?.publicConfigJson ? JSON.parse(setting.publicConfigJson) as AiPublicConfig : {};
  const secrets = setting?.encryptedSecrets ? decryptJson<AiSecrets>(setting.encryptedSecrets) : {};
  const baseUrl = publicConfig.baseUrl || process.env.AI_BASE_URL || "";
  const model = publicConfig.model || process.env.AI_MODEL || "";
  const apiKey = secrets.apiKey || process.env.AI_API_KEY || "";
  return { providerName: publicConfig.providerName || process.env.AI_PROVIDER_NAME || "OpenAI-compatible provider", baseUrl, model, apiKey };
}

function completionUrl(baseUrl: string) {
  const normalized = validateAiBaseUrl(baseUrl);
  if (normalized.endsWith("/chat/completions")) return normalized;
  return `${normalized}${normalized.endsWith("/v1") ? "" : "/v1"}/chat/completions`;
}

export async function getAiProviderStatus() {
  const config = await loadAiConfiguration();
  return { configured: Boolean(config.baseUrl && config.model), providerName: config.providerName, model: config.model || null };
}

export async function invokeAiProvider(messages: AiMessage[]) {
  const config = await loadAiConfiguration();
  if (!config.baseUrl || !config.model) throw new Error("The AI assistant provider is not configured.");
  const response = await fetch(completionUrl(config.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.1 }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`AI provider request failed with status ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("The AI provider returned an empty response.");
  return content;
}

export async function testAiProviderConnection() {
  const startedAt = Date.now();
  try {
    const answer = await invokeAiProvider([{ role: "system", content: "Reply with the single word OK." }, { role: "user", content: "Connection test" }]);
    return { provider: "ai_assistant", target: "chat completions", status: "success" as const, message: `AI provider responded: ${answer.slice(0, 80)}`, durationMs: Date.now() - startedAt, testedAt: new Date() };
  } catch (error) {
    return { provider: "ai_assistant", target: "chat completions", status: "failure" as const, message: error instanceof Error ? error.message : "AI provider test failed.", durationMs: Date.now() - startedAt, testedAt: new Date() };
  }
}
