# Administration Expansion Operator Guide

## Microsoft Graph readiness

The portal keeps Microsoft Entra, SharePoint, and Graph Mail settings **blank by default**. Administrators configure them only in **Integration Settings**. For SharePoint backups, configure the application integration first, enter the SharePoint site address, use discovery to obtain the site and library IDs, then copy the IDs into the SharePoint backup destination. No browser receives a client secret.

Graph Mail uses the configured application sender mailbox, application `Mail.Send` permission with tenant administrator consent, and an optional default BCC recipient. Until the sender mailbox and Graph application are configured, template sends and automatic publish notifications are logged as **unconfigured** and no message is delivered.

## Resource and section administration

The Access & Pages screen lets administrators edit resource labels, navigation groups, custom page titles, page body content, access policy, and application-card action text. Reorder resources by drag and drop; keyboard reordering remains available as an accessible alternative. Changes are persisted server-side and recorded in the System Audit Center.

## Roles and employee submissions

The built-in **Intranet Portal Manager** role can manage content, resources, backups, email operations, content approval, and audit review without becoming a full administrator. Administrators can create additional roles and select granular permissions.

Authenticated employees can submit announcements and events. Submissions remain pending until an administrator or assigned Intranet Portal Manager approves or declines them in **Content Approval**. Approval publishes the item and processes active event templates, with every action retained in the audit timeline.

## Birthday calendar

The existing **Holidays & Birthdays** calendar presents birthdays by month and day only. Birth years are never returned to the portal client. Administrators maintain birthday month and day through employee profile administration, and employees must explicitly opt in through their profile before their birthday appears in the calendar.

## Local account lifecycle and identity transitions

Under **Integration Settings → Local access**, administrators can create accounts, enforce or reset TOTP MFA, disable local password login, and select a future identity-provider transition state. Selecting **Microsoft Entra**, **OIDC**, or **SAML** immediately disables the account’s local password login and revokes its sessions. It does not itself provision an external account: configure and validate the selected enterprise provider before directing the employee to use it.

## Fresh-install migration safety

The Docker and VPS installers apply the complete migration history. The release includes corrected no-op and breakpoint migration files so a fresh MySQL installation does not submit an empty or duplicate SQL statement before the migration journal is recorded.

## System Audit Center

The Audit Center provides searchable records for portal resource changes, roles, user lifecycle controls, backups, email deliveries, content approvals, and security operations. It intentionally stores configuration metadata and outcome information, not plaintext credentials, passwords, MFA secrets, or email-message secrets.

## Backup safety boundaries

Every retained backup snapshot is encrypted using the deployment's application encryption key before writing to the configured destination and then read back for checksum verification. Administrators choose one scope per destination:

| Scope | Includes |
| --- | --- |
| Configuration only | Non-secret integration and portal configuration |
| Configuration and encrypted secrets | Configuration plus existing encrypted secret envelopes |
| Encrypted secrets only | Existing encrypted secret envelopes only |
| Full platform data snapshot | Portal data, configuration, encrypted credentials, and authorization records |

Local encrypted artifact retention is configured per destination. Set `BACKUP_LOCAL_DIR` to a persistent, access-controlled mounted volume; its default is `data/backups` under the application working directory. Retained local artifacts can be downloaded by an administrator until the retention period expires. The encrypted artifact still requires the original `JWT_SECRET` for decryption during a supported recovery process.

> A full-platform **data** snapshot does not replace a host-level backup of container images, uploaded-file volumes, database-engine physical backups, TLS material, or the original environment file. Use the target-specific VPS, Docker, Azure VM, and Azure Container Apps runbooks together with this guide.

## Scheduled backups

The portal stores a five-field UTC cron expression for each enabled destination and exposes a protected scheduled dispatch endpoint. Configure the deployment platform's scheduler to call that endpoint with its `CRON_SECRET`; do not rely on an in-process timer. A scheduled run has the same encryption, destination write/read/checksum verification, local retention, and audit behavior as a manual run.
