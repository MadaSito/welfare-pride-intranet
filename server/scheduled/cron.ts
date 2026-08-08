import { CronExpressionParser } from "cron-parser";

export function isValidCronExpression(expression: string) {
  try {
    CronExpressionParser.parse(expression, { tz: "UTC" });
    return expression.trim().split(/\s+/).length === 5;
  } catch {
    return false;
  }
}

export function isCronDue(expression: string, lastDispatchedAt: Date | null, now = new Date()) {
  const currentDate = lastDispatchedAt || new Date(now.getTime() - 61_000);
  const interval = CronExpressionParser.parse(expression, { currentDate, tz: "UTC" });
  return interval.next().toDate().getTime() <= now.getTime();
}
