# Restricted Pages and Entra Group Visibility Architecture

## Purpose

This design adds administrator-managed intranet pages, including a configurable **Business Management** section, without treating client-side navigation as an authorization control. Every restricted resource is evaluated on the server before content or data is returned.

## Access model

| Concept | Design |
| --- | --- |
| Portal resource | A fixed module or administrator-created page with a stable `resourceKey`, label, path, navigation group, display icon, sort order, and publication state. |
| Built-in module | A seeded resource such as `module:hr`, `module:directory`, or `module:technology`. It remains backed by its existing server router. |
| Custom page | A resource of type `page`, created by an administrator. Its route is derived from a validated unique slug and rendered as plain text content; raw HTML is never stored or rendered. |
| Access mode | `all_authenticated` permits all full local or Entra sessions. `restricted` permits only an explicitly assigned local user or a currently synchronized Entra group. |
| Administrator | Administrators retain server-side access to resources so they can recover or change policies. Existing admin procedures remain role-protected. |
| Denial behavior | Restricted resources fail closed. If a membership snapshot is absent, expired, or cannot be refreshed, the user does not receive restricted content or navigation. |

## Data model

The migration will add the following additive tables.

| Table | Purpose |
| --- | --- |
| `portal_resources` | Stores built-in modules and administrator-created pages, their server-recognized resource keys, routes, navigation metadata, text body, visibility, and access mode. |
| `portal_resource_assignments` | Maps a restricted resource to either a local user ID or an Entra group object ID. Database uniqueness prevents duplicate mappings. |
| `entra_groups` | Stores only group object IDs and safe display metadata observed during a successful Entra sign-in or administrator mapping. |
| `user_entra_group_memberships` | Stores the latest direct Entra group membership snapshot for a portal user. Memberships are replaced atomically per successful synchronization. |
| `access_control_audit_events` | Records administrator creation, page publication, policy, and assignment changes without recording credentials or tokens. |

## Entra synchronization

OIDC sign-in obtains group membership using the delegated signed-in-user context. The implementation first accepts a validated `groups` ID-token claim when present. When Entra signals group overage, or when token groups are absent, it calls Microsoft Graph `/me/memberOf/microsoft.graph.group` with the user’s delegated access token, handles paging, and persists only IDs and display names needed by the access policy. It does not rely on legacy `_claim_sources` endpoint values. SAML sign-in can synchronize explicitly issued group claims; a SAML overage indication produces no restricted entitlement until the user completes a group-capable OIDC sign-in.

> Microsoft documents that `/me/memberOf` operates in the signed-in delegated context, and that group-token overage must be detected and resolved through Microsoft Graph rather than by trusting a legacy claim-source endpoint.[1] [2]

The default scope configuration is extended with the least privilege needed for direct membership reads. Administrators must consent to any additional scope required by their tenant policy. Group assignments use Entra object IDs rather than names; display names are convenience metadata only and are never authorization keys.

## Enforcement

Every protected portal router uses a shared `portalResourceProcedure(resourceKey)` guard for its module. The guard verifies a full session, preserves existing administrator controls, loads the resource policy, and checks direct user assignments plus the latest Entra membership snapshot. The same guard is used by the custom-page API. The frontend requests a server-filtered navigation model but cannot bypass the guard by manually visiting a route or calling an RPC procedure.

## Administrator experience

The **Access & Pages** section within Integration Settings lets an administrator create, edit, publish, unpublish, and delete custom pages; define the Business Management section; choose `all authenticated` or `restricted`; assign individual portal users; and assign Entra groups by object ID. It also lets an administrator apply the same visibility policy to selected built-in modules. All assignments and policy changes create audit events.

## Security decisions

Custom page bodies are plain text with a bounded length and pre-wrapped rendering, eliminating script and raw-HTML injection. Slugs use a strict lowercase URL-safe format and reserved paths cannot be claimed. Group memberships are never accepted from a browser request. The application uses server-side user IDs and Entra object IDs only, validates all mutation input with Zod, and avoids returning membership snapshots to users who are not administrators.

## References

[1]: https://learn.microsoft.com/en-us/graph/api/user-list-memberof?view=graph-rest-1.0 "Microsoft Graph: List a user's direct memberships"
[2]: https://learn.microsoft.com/en-us/security/zero-trust/develop/configure-tokens-group-claims-app-roles "Microsoft Entra: Configure group claims and app roles in tokens"
[3]: https://learn.microsoft.com/en-us/graph/permissions-overview "Microsoft Graph permissions overview"
