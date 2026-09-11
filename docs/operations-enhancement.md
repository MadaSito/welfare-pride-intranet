# Operations Enhancement Guide

## Audit Center access and investigation

Administrators open the **System Audit Center** from **Administration → Audit Center**. Users assigned the **Intranet Portal Manager** role with the `view_audit` permission open it from **Management → Audit Center**. The center provides a searchable change timeline and two live, bounded 30-day charts: frequent administrative actions and configuration changes. Selecting either a chart bar or its matching action button applies that event type to the timeline filter and moves focus toward the relevant records.

## Production readiness controls

The **Integration Settings** page provides a readiness panel linking directly to Email Center, Roles & Permissions, Backup Center, and Audit Center. Microsoft Graph Mail and SharePoint remain deliberately inactive until an administrator supplies tenant values, grants the required consent, and saves the configuration. No Microsoft credential was added by this release.

## Birthday congratulations

An administrator creates a **Birthday congratulations** template in **Administration → Email Center** and enables it. The supported plain-text placeholders are `{{firstName}}` and `{{displayName}}`. Only active employees who have opted into birthday visibility, have a birthday month and day matching the dispatch date, and have a retained email address are eligible.

The standalone scheduler calls the authenticated `/api/cron/dispatch` endpoint. Birthday delivery runs once per day at `BIRTHDAY_DISPATCH_HOUR_UTC` and `BIRTHDAY_DISPATCH_MINUTE_UTC`; the safe defaults are `09` and `00` respectively. The same environment must retain `CRON_SECRET`, and the self-hosted scheduler invokes the endpoint using that secret. A per-template, per-profile, per-year delivery key makes duplicate scheduler calls idempotent. Every outcome, including an unconfigured Graph Mail attempt, is retained in Email Center and recorded in the System Audit Center.

> The feature records an **unconfigured** delivery rather than sending mail until Graph Mail has a sender mailbox, encrypted Microsoft credentials, the `Mail.Send` application permission, and administrator consent.

## Operational review

Review active roles, backup destinations, scope, retention, and verification controls before enabling production dispatch. Use the Audit Center after policy changes to confirm the resulting change records, and use Email Center to review or resend a retained birthday delivery when appropriate.
