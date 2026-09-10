export const BACKUP_SCOPES = ["configuration", "configuration_and_secrets", "secrets_only", "full_platform"] as const;
export type BackupScope = typeof BACKUP_SCOPES[number];

export function normalizeLocalRetentionDays(value: number | null | undefined) {
  const numeric = Number.isFinite(value) ? Math.floor(Number(value)) : 30;
  return Math.min(Math.max(numeric, 1), 3650);
}

export function backupScopeLabel(scope: BackupScope) {
  return scope.replaceAll("_", " ");
}
