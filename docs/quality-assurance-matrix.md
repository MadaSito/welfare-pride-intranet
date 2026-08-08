# Welfare Pride Portal Quality-Assurance Matrix

The portal was reviewed route by route after implementation. Data-backed routes were checked for applicable loading, empty, success, validation, unconfigured, unauthorized, and failure behavior. Static or administrator-authored content pages do not require every asynchronous state; those exceptions are noted below.

| Route | State behavior reviewed | Accessibility and interaction review | Responsive evidence |
| --- | --- | --- | --- |
| `/` | Intentional empty announcement, event, and integration-readiness states | Main landmark, keyboard-reachable module cards, visible focus | Desktop and mobile |
| `/people`, `/people/me` | Graph unconfigured/degraded fallback, profile success/edit validation, upload errors | Search, department filter, profile card/dialog controls | Desktop and mobile |
| `/organization` | Graph unconfigured/degraded fallback and single-node cache | Search, keyboard-selectable employee cards, labeled zoom controls | Desktop and tablet |
| `/calendars` | SharePoint unconfigured, empty holiday/birthday/event summaries, query failure | Labeled month navigation and keyboard-selectable day cells | Desktop and mobile |
| `/announcements` | Empty, list/detail, create/edit validation, archive success/error | List/detail controls, labeled form fields, dialogs | Desktop |
| `/events` | Empty, filtered list, month calendar, detail, create/edit/cancel states | List/calendar mode controls, category filter, dialogs | Desktop and tablet |
| `/hr` | SharePoint unconfigured/degraded, empty authorized result, search/filter states | Explicit permission notice, search, category, view switch | Desktop and mobile |
| `/links` | Seeded success, search-empty, create/edit validation and mutation feedback | External-link semantics, labeled switches/edit buttons | Desktop |
| `/about` | Empty administrator-authored content, query failure, edit/upload validation | Semantic sections, labeled editor controls | Desktop |
| `/founders` | Empty founder/milestone state, query failure, administrator validation | Biography cards, timeline order, editor dialogs | Desktop |
| `/technology` | Empty, unconfigured, validation failure, iframe/load guidance | HTTPS and allowlist guidance, administrator dialogs | Desktop and tablet |
| `/admin/integrations` | Unconfigured, diagnostics-empty, save/test pending, success and failure feedback | Administrator guard, labeled secret fields, tab keyboard behavior | Desktop and mobile |
| `/admin/backups` | No-destination, configured, test/dry-run/run pending and failure states | Administrator guard, provider dialogs, schedule controls | Desktop and tablet |
| `/admin/restores` | No-manifest, audit-empty, guarded confirmation, success/failure | Administrator guard, typed confirmation dialog | Desktop |
| Unknown route | Not-found escape route | Return navigation | Shell behavior inherited |

The persistent shell was reviewed at desktop, tablet, and mobile widths. Desktop preserves the full navigation rail, tablet retains usable content proportions, and mobile uses the sidebar trigger with a single-column content flow. Full-page screenshots covered all major route families over the implementation phases.

Global accessibility controls include semantic `main`, `header`, and `footer` landmarks; visible `:focus-visible` outlines; Radix keyboard behavior for dialogs, menus, tabs, and selections; explicit labels on icon-only controls; and a `prefers-reduced-motion: reduce` override. Complex custom controls—the organization chart, monthly calendar, profile editor, secure embeds, backup controls, and restore confirmation—received targeted inspection.
