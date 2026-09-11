# PA Health and Wellness and Call Center Portal Sections

## Delivered scope

This release adds a **PA Health and Wellness** navigation group with an editable Health & Wellness Resources page, a privacy-aware all-dates Health & Wellness Calendar, and an events-only Health & Wellness Events calendar. It adds a **Jefferson Health Partners Call Center** navigation group with editable Call Center Resources and Call Center Notes pages. All labels, section titles, content, access policies, ordering, and calendar modes remain administrator-managed through **Administration → Access & Pages**.

## Security and implementation notes

Editable calendar pages use a distinct `calendar` portal-resource type and server-side path authorization. The all-dates view reuses the existing holiday, approved-event, and consented birthday projection. The events-only view excludes holiday and birthday data. The migration expands the resource-type enum, adds calendar-view metadata, and idempotently provisions the five requested resources without overwriting later administrator edits.

## Validation record

The full release gate passed with 82 automated tests, TypeScript validation, production build, dependency audit, and Drizzle consistency checks. A fresh isolated loopback-only Docker deployment ran the complete migration history. It validated administrator resource editing, authenticated all-dates and events-only calendar routes, and the lower sidebar navigation after scrolling. Temporary containers, volumes, credentials, browser tooling, screenshots, scripts, workspaces, and loopback bindings were removed after acceptance.
