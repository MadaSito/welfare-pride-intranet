import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { NextFunction, Request, Response } from "express";
import * as db from "../db";

export const CORRELATION_ID_HEADER = "X-Correlation-ID";

export type SecurityDecision =
  | { allowed: true; reason: "allowed" }
  | { allowed: false; reason: "blocked_ip" | "allowlist_rejected" | "suspicious_request" | "rate_limited" };

type SecurityPolicy = Awaited<ReturnType<typeof db.listActiveSecurityIpPolicies>>[number];

type WindowCounter = { count: number; resetAt: number };

const suspiciousRequestPattern = /(?:%2e%2e|\.\.(?:\/|\\)|%3cscript|<script|\/(?:\.git|\.env|wp-admin|wp-login\.php|phpmyadmin|vendor\/phpunit)(?:\/|$))/i;

function safeHash(value: string | undefined) {
  return value ? createHash("sha256").update(value).digest("hex") : null;
}

export function normalizeClientIp(value: string | undefined | null) {
  const candidate = value?.trim() || "";
  if (!candidate) return "unknown";
  const withoutPort = candidate.startsWith("[") ? candidate.slice(1, candidate.indexOf("]")) : candidate;
  const normalized = withoutPort.startsWith("::ffff:") ? withoutPort.slice(7) : withoutPort;
  return isIP(normalized) ? normalized : "unknown";
}

export function getTrustedClientIp(req: Pick<Request, "ip" | "socket">) {
  return normalizeClientIp(req.ip || req.socket.remoteAddress);
}

export function evaluateIpPolicies(input: { ipAddress: string; allowlistEnabled: boolean; policies: SecurityPolicy[] }): SecurityDecision {
  const matches = input.policies.filter(policy => policy.ipAddress === input.ipAddress);
  if (matches.some(policy => policy.mode === "block")) return { allowed: false, reason: "blocked_ip" };
  if (input.allowlistEnabled && !matches.some(policy => policy.mode === "allow")) return { allowed: false, reason: "allowlist_rejected" };
  return { allowed: true, reason: "allowed" };
}

export function isSuspiciousRequestPath(value: string) {
  return suspiciousRequestPattern.test(value);
}

export class FixedWindowRateLimiter {
  private readonly counters = new Map<string, WindowCounter>();
  private readonly violations = new Map<string, number[]>();

  consume(key: string, maxRequests: number, windowMs: number) {
    const now = Date.now();
    const prior = this.counters.get(key);
    const current = !prior || prior.resetAt <= now ? { count: 0, resetAt: now + windowMs } : prior;
    current.count += 1;
    this.counters.set(key, current);
    return {
      allowed: current.count <= maxRequests,
      firstDenied: current.count === maxRequests + 1,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  recordViolation(ipAddress: string, windowMs: number) {
    const now = Date.now();
    const entries = (this.violations.get(ipAddress) || []).filter(timestamp => timestamp > now - windowMs);
    entries.push(now);
    this.violations.set(ipAddress, entries);
    return entries.length;
  }
}

const rateLimiter = new FixedWindowRateLimiter();

function reject(res: Response, correlationId: string, decision: Exclude<SecurityDecision, { allowed: true }>, retryAfterSeconds?: number) {
  if (retryAfterSeconds) res.setHeader("Retry-After", String(retryAfterSeconds));
  const status = decision.reason === "rate_limited" ? 429 : 403;
  return res.status(status).json({ error: "Request denied by the Welfare Pride security policy.", correlationId });
}

function eventDetails(input: { reason: SecurityDecision["reason"]; policyId?: number; retryAfterSeconds?: number; automated?: boolean }) {
  return JSON.stringify({ reason: input.reason, policyId: input.policyId ?? null, retryAfterSeconds: input.retryAfterSeconds ?? null, automated: input.automated ?? false });
}

async function recordDecision(input: {
  correlationId: string;
  req: Request;
  ipAddress: string;
  decision: Exclude<SecurityDecision, { allowed: true }>;
  policyId?: number;
  retryAfterSeconds?: number;
  severity: "low" | "medium" | "high" | "critical";
  automated?: boolean;
}) {
  await db.appendSecurityEvent({
    correlationId: input.correlationId,
    eventType: input.decision.reason,
    severity: input.severity,
    ipAddress: input.ipAddress === "unknown" ? null : input.ipAddress,
    method: input.req.method.slice(0, 12),
    requestPath: input.req.path.slice(0, 240),
    userAgentHash: safeHash(input.req.get("user-agent")),
    detailsJson: eventDetails({
      reason: input.decision.reason,
      policyId: input.policyId,
      retryAfterSeconds: input.retryAfterSeconds,
      automated: input.automated,
    }),
  });
}

export async function securityCenterMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = randomUUID();
  const ipAddress = getTrustedClientIp(req);
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  if (req.path === "/api/healthz") return next();

  const [settings, policies] = await Promise.all([db.getSecuritySettings(), db.listActiveSecurityIpPolicies()]);
  const policyDecision = evaluateIpPolicies({ ipAddress, allowlistEnabled: settings.allowlistEnabled, policies });
  if (!policyDecision.allowed) {
    const matchedPolicy = policies.find(policy => policy.ipAddress === ipAddress && policy.mode === "block");
    void recordDecision({ correlationId, req, ipAddress, decision: policyDecision, policyId: matchedPolicy?.id, severity: policyDecision.reason === "blocked_ip" ? "high" : "medium" });
    return reject(res, correlationId, policyDecision);
  }

  if (isSuspiciousRequestPath(req.originalUrl)) {
    const decision: SecurityDecision = { allowed: false, reason: "suspicious_request" };
    void recordDecision({ correlationId, req, ipAddress, decision, severity: "high" });
    return reject(res, correlationId, decision);
  }

  if (req.path.startsWith("/api/")) {
    const windowMs = settings.rateLimitWindowSeconds * 1000;
    const result = rateLimiter.consume(ipAddress, settings.rateLimitRequests, windowMs);
    if (!result.allowed) {
      const decision: SecurityDecision = { allowed: false, reason: "rate_limited" };
      const violations = result.firstDenied ? rateLimiter.recordViolation(ipAddress, windowMs) : 0;
      if (result.firstDenied) {
        void recordDecision({ correlationId, req, ipAddress, decision, severity: "medium", retryAfterSeconds: result.retryAfterSeconds });
      }

      if (result.firstDenied && settings.autoBlockThreshold > 0 && ipAddress !== "unknown" && violations >= settings.autoBlockThreshold) {
        const expiresAt = new Date(Date.now() + settings.autoBlockDurationMinutes * 60_000);
        const policy = await db.upsertSecurityIpPolicy({
          mode: "block",
          ipAddress,
          label: "Automatic rate-limit response",
          expiresAt,
          createdByUserId: null,
        });
        void db.appendSecurityEvent({
          correlationId,
          eventType: "automatic_ip_block_created",
          severity: "high",
          ipAddress,
          method: req.method.slice(0, 12),
          requestPath: req.path.slice(0, 240),
          userAgentHash: safeHash(req.get("user-agent")),
          detailsJson: eventDetails({ reason: "rate_limited", policyId: policy?.id, retryAfterSeconds: result.retryAfterSeconds, automated: true }),
        });
      }
      return reject(res, correlationId, decision, result.retryAfterSeconds);
    }
  }

  return next();
}
