import type { Request, Response } from "express";
import * as db from "../db";
import { executeBackupRun } from "../integrations/backupAdapters";
import { sdk } from "../_core/sdk";

export async function scheduledBackupHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const destination = await db.getBackupDestinationByTaskUid(user.taskUid);
    if (!destination) return res.json({ ok: true, skipped: "orphan" });
    if (!destination.isEnabled) return res.json({ ok: true, skipped: "destination-disabled" });
    const latest = await db.getLatestBackupRunForDestination(destination.id);
    if (latest && Date.now() - latest.startedAt.getTime() < 5 * 60_000) return res.json({ ok: true, skipped: "recent-run", runId: latest.id });
    const run = await executeBackupRun(destination, "backup", null);
    return res.json({ ok: true, runId: run?.id });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Scheduled backup failed", stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
