import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import * as db from "../db";
import { executeBackupRun } from "../integrations/backupAdapters";
import { isCronDue, isValidCronExpression } from "./cron";
import { dispatchBirthdayCongratulations } from "../email/birthdayDispatch";
import { isBirthdayDispatchDue, parseBirthdayDispatchSettings } from "../email/birthdaySchedule";

function cronAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET || "";
  const authorization = req.headers.authorization || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !provided) return false;
  return timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest());
}

export async function scheduledBackupHandler(req: Request, res: Response) {
  if (!cronAuthorized(req)) return res.status(401).json({ error: "Unauthorized scheduled dispatch" });
  const now = new Date();
  const destinations = await db.listEnabledBackupSchedules();
  const results: Array<{ destinationId: number; status: string; runId?: number }> = [];

  for (const destination of destinations) {
    try {
      if (!destination.scheduleCron || !isValidCronExpression(destination.scheduleCron)) {
        results.push({ destinationId: destination.id, status: "invalid-schedule" });
        continue;
      }
      if (!isCronDue(destination.scheduleCron, destination.lastScheduledDispatchAt, now)) continue;
      const latest = await db.getLatestBackupRunForDestination(destination.id);
      if (latest && now.getTime() - latest.startedAt.getTime() < 5 * 60_000) {
        results.push({ destinationId: destination.id, status: "recent-run", runId: latest.id });
        continue;
      }
      await db.markBackupScheduleDispatched(destination.id, now);
      const run = await executeBackupRun(destination, "backup", null);
      results.push({ destinationId: destination.id, status: "succeeded", runId: run?.id });
    } catch {
      results.push({ destinationId: destination.id, status: "failed" });
    }
  }

  const savedBirthdayDispatch = await db.getIntegrationSettingByProvider("birthday_dispatch");
  let savedBirthdayConfig: unknown;
  try { savedBirthdayConfig = savedBirthdayDispatch?.publicConfigJson ? JSON.parse(savedBirthdayDispatch.publicConfigJson) : undefined; } catch { savedBirthdayConfig = undefined; }
  const birthdaySettings = parseBirthdayDispatchSettings(savedBirthdayConfig);
  const birthdayResult = !birthdaySettings.enabled
    ? { status: "disabled" as const, processed: 0, sent: 0 }
    : isBirthdayDispatchDue(now, birthdaySettings)
      ? await dispatchBirthdayCongratulations(now, birthdaySettings.timeZone)
      : { status: "outside-window" as const, processed: 0, sent: 0 };
  return res.json({ ok: true, checkedAt: now.toISOString(), results, birthdayResult });
}
