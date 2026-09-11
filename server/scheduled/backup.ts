import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import * as db from "../db";
import { executeBackupRun } from "../integrations/backupAdapters";
import { isCronDue, isValidCronExpression } from "./cron";
import { dispatchBirthdayCongratulations } from "../email/birthdayDispatch";

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

  const configuredBirthdayHour = Number.parseInt(process.env.BIRTHDAY_DISPATCH_HOUR_UTC || "9", 10);
  const configuredBirthdayMinute = Number.parseInt(process.env.BIRTHDAY_DISPATCH_MINUTE_UTC || "0", 10);
  const birthdayDispatchHour = Number.isInteger(configuredBirthdayHour) && configuredBirthdayHour >= 0 && configuredBirthdayHour <= 23 ? configuredBirthdayHour : 9;
  const birthdayDispatchMinute = Number.isInteger(configuredBirthdayMinute) && configuredBirthdayMinute >= 0 && configuredBirthdayMinute <= 59 ? configuredBirthdayMinute : 0;
  const birthdayResult = now.getUTCMinutes() === birthdayDispatchMinute && now.getUTCHours() === birthdayDispatchHour ? await dispatchBirthdayCongratulations(now) : { status: "outside-window", processed: 0, sent: 0 };
  return res.json({ ok: true, checkedAt: now.toISOString(), results, birthdayResult });
}
