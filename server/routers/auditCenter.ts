import { z } from "zod";
import * as db from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const auditCenterRouter = router({
  list: permissionProcedure("view_audit").input(z.object({ entityType: z.string().trim().max(80).optional(), eventType: z.string().trim().max(120).optional(), status: z.string().trim().max(80).optional(), query: z.string().trim().max(120).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.number().int().min(1).max(500).optional() })).query(async ({ input }) => db.searchOperationAuditEvents(input)),
});
