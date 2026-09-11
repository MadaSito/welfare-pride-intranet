export type AuditAnalyticsEvent = {
  entityType: string;
  eventType: string;
  createdAt: Date;
};

export type AuditAnalyticsRow = { eventType: string; label: string; count: number };

function titleize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}

function rank(events: AuditAnalyticsEvent[], predicate: (event: AuditAnalyticsEvent) => boolean) {
  const counts = new Map<string, number>();
  for (const event of events) if (predicate(event)) counts.set(event.eventType, (counts.get(event.eventType) || 0) + 1);
  return Array.from(counts, ([eventType, count]) => ({ eventType, label: titleize(eventType), count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 8);
}

const configurationEntities = new Set(["backup_destination", "email_template", "integration_setting", "local_user", "portal_resource", "portal_role", "portal_user_role_assignment"]);

export function summarizeAuditAnalytics(events: AuditAnalyticsEvent[]) {
  return {
    totalEvents: events.length,
    administrativeActions: rank(events, () => true),
    configurationChanges: rank(events, event => configurationEntities.has(event.entityType) || /(config|template|role|resource|backup|schedule|retention|lifecycle)/i.test(event.eventType)),
  };
}
