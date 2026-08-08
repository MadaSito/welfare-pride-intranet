export const INTEGRATION_PROVIDERS = [
  "microsoft_entra",
  "microsoft_graph",
  "sharepoint",
] as const;

export const BACKUP_PROVIDERS = [
  "sharepoint",
  "onedrive",
  "google_drive",
  "aws_s3",
  "wasabi",
  "backblaze_b2",
  "azure_blob",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export type BackupProvider = (typeof BACKUP_PROVIDERS)[number];
export type ExternalStatus = "unconfigured" | "configured" | "connected" | "degraded" | "error";

export type PublicIntegrationSetting = {
  provider: IntegrationProvider;
  displayName: string;
  publicConfig: Record<string, string>;
  configuredSecrets: Record<string, boolean>;
  status: ExternalStatus;
  lastTestedAt: Date | null;
};

export type ConnectionDiagnosticResult = {
  provider: IntegrationProvider | BackupProvider;
  target: string;
  status: "success" | "failure" | "unconfigured";
  message: string;
  durationMs: number;
  testedAt: Date;
};

export type BirthdayDisplay = {
  profileId: number;
  displayName: string;
  photoUrl: string | null;
  month: number;
  day: number;
};

export type DirectoryNode = {
  id: string;
  profileId: number | null;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  officeLocation: string | null;
  photoUrl: string | null;
  managerId: string | null;
};

export type ExternalCollection<T> = {
  status: ExternalStatus;
  source: "portal" | "microsoft_graph" | "sharepoint";
  message?: string;
  items: T[];
  syncedAt: Date | null;
};
