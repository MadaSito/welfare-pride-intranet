# Operations Enhancement Guide

## Audit Center access and investigation

Administrators open the **System Audit Center** from **Administration → Audit Center**. Users assigned the **Intranet Portal Manager** role with the `view_audit` permission open it from **Management → Audit Center**. The center provides a searchable change timeline and two live, bounded 30-day charts: frequent administrative actions and configuration changes. Selecting either a chart bar or its matching action button applies that event type to the timeline filter and moves focus toward the relevant records.

## Production readiness controls

The **Integration Settings** page provides a readiness panel linking directly to Email Center, Roles & Permissions, Backup Center, and Audit Center. Microsoft Graph Mail and SharePoint remain deliberately inactive until an administrator supplies tenant values, grants the required consent, and saves the configuration. No Microsoft credential was added by this release.

## Birthday congratulations

An administrator creates a **Birthday congratulations** template in **Administration → Email Center** and enables it. The supported plain-text placeholders are `{{firstName}}` and `{{displayName}}`. Only active employees who have opted into birthday visibility, have a birthday month and day matching the dispatch date, and have a retained email address are eligible.

Before saving or enabling a template, select **Preview birthday email** and enter a sample employee name. The preview renders the current unsaved draft using the same supported placeholders as the scheduler. It does not send mail, create an Email Center delivery record, or expose Graph configuration.

The daily delivery schedule is configured in **Administration → Integration Settings → Microsoft 365 → Birthday congratulations schedule**. Administrators choose the 24-hour dispatch time, an IANA timezone such as `UTC` or `America/New_York`, and whether automated delivery is enabled. The authenticated `/api/cron/dispatch` endpoint evaluates the saved local time in that timezone; `UTC` preserves a fixed UTC time, while a regional timezone preserves a local time through daylight-saving transitions. If no administrator setting exists, the safe environment fallback is `09:00 UTC` using `BIRTHDAY_DISPATCH_HOUR_UTC`, `BIRTHDAY_DISPATCH_MINUTE_UTC`, and `BIRTHDAY_DISPATCH_TIME_ZONE`. The same environment must retain `CRON_SECRET`, and the self-hosted scheduler invokes the endpoint using that secret. A per-template, per-profile, per-year delivery key makes duplicate scheduler calls idempotent. Every outcome, including an unconfigured Graph Mail attempt, is retained in Email Center and recorded in the System Audit Center.

> The feature records an **unconfigured** delivery rather than sending mail until Graph Mail has a sender mailbox, encrypted Microsoft credentials, the `Mail.Send` application permission, and administrator consent.

## Operational review

Use **Export 30-day PDF** in the System Audit Center header to generate a browser-downloaded management report. The report contains the current 30-day administrative-action and configuration-change charts, a concise executive summary, the active timeline filters, and up to 300 matching retained timeline records. The portal records the export event before generating the browser-side file; reports are not stored on the server.

Review active roles, backup destinations, scope, retention, and verification controls before enabling production dispatch. Use the Audit Center after policy changes to confirm the resulting change records, and use Email Center to review or resend a retained birthday delivery when appropriate.
