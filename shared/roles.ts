export const PORTAL_PERMISSIONS = [
  "manage_content",
  "approve_submissions",
  "manage_resources",
  "manage_backups",
  "view_audit",
  "manage_email",
  "manage_users",
  "manage_roles",
] as const;

export type PortalPermission = typeof PORTAL_PERMISSIONS[number];

export const INTRANET_PORTAL_MANAGER_PERMISSIONS: PortalPermission[] = [
  "manage_content",
  "approve_submissions",
  "manage_resources",
  "manage_backups",
  "view_audit",
  "manage_email",
];
