import type {
  BackupProvider,
  ConnectionDiagnosticResult,
  DirectoryNode,
  ExternalCollection,
  IntegrationProvider,
} from "../../shared/domain";

export type MicrosoftPublicConfig = {
  tenantId?: string;
  clientId?: string;
  authorityUrl?: string;
  redirectUri?: string;
  graphBaseUrl?: string;
  graphScopes?: string;
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlIdpIssuer?: string;
  samlCallbackUrl?: string;
  sharePointSiteUrl?: string;
  sharePointSiteId?: string;
  holidayListId?: string;
  hrLibraryId?: string;
};

export type MicrosoftSecrets = {
  clientSecret?: string;
  samlCertificate?: string;
};

export type BackupPublicConfig = {
  clientId?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  container?: string;
  driveId?: string;
  folderPath?: string;
  accountName?: string;
};

export type BackupSecrets = {
  accessKeyId?: string;
  secretAccessKey?: string;
  applicationKeyId?: string;
  applicationKey?: string;
  connectionString?: string;
  refreshToken?: string;
  clientSecret?: string;
};

export interface DirectoryProvider {
  listPeople(): Promise<ExternalCollection<DirectoryNode>>;
  testConnection(): Promise<ConnectionDiagnosticResult>;
}

export interface SharePointProvider {
  listHolidays(range: { from: Date; to: Date }): Promise<ExternalCollection<unknown>>;
  listDocuments(input: { query?: string; category?: string }): Promise<ExternalCollection<unknown>>;
  testConnection(): Promise<ConnectionDiagnosticResult>;
}

export interface BackupAdapter {
  readonly provider: BackupProvider;
  testConnection(): Promise<ConnectionDiagnosticResult>;
  dryRun(input: { artifactName: string; body: Buffer; checksumSha256: string }): Promise<{
    verified: boolean;
    remoteReference?: string;
    message: string;
  }>;
}

export type IntegrationAdapterFactory = {
  provider: IntegrationProvider;
  create: () => DirectoryProvider | SharePointProvider;
};
