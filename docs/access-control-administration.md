# Welfare Pride Access Control Administration

## Purpose and operating model

The Welfare Pride intranet uses **server-enforced resource authorization** for every managed portal module and custom page. The sidebar is a convenience view only: an employee who manually enters a hidden URL or calls an API endpoint cannot access a resource unless the server grants that resource to the authenticated user.

Access may be granted to every authenticated employee, to named local or Entra-provisioned users, or to **Microsoft Entra group object IDs**. The appropriate model for a Business Management page is a restricted custom page or restricted built-in Business Management module with a group assignment. Administrators retain access to administer the portal; regular employees are evaluated against their direct assignments and fresh Entra group snapshots.

| Assignment option | Appropriate use | Authorization behavior |
| --- | --- | --- |
| All authenticated employees | General company content, benefits, calendars, and common HR information | Visible and accessible to every full-authentication session. |
| Specific users | Temporary projects, confidential individual assignments, executive assistance, and pilot pages | Accessible only to the selected user records and administrators. |
| Entra group | Departments, business units, leadership teams, and Business Management audiences | Accessible only when the signed-in person has a fresh synchronized membership for the assigned Entra group object ID. |

> **Important:** Resource hiding is not authorization. Welfare Pride always applies the matching access rule in the server procedure before returning protected data or page content.

## Creating a restricted page or tab

Sign in as an administrator and open **Access & Pages**. Create a new page, choose a lowercase URL slug, give the page a title and navigation section, enter approved plain-text content, and set the page to **Restricted**. Assign at least one person or Microsoft Entra group. A page can be published only after its access rule is valid.

The page is available at `/pages/<slug>`. Welfare Pride validates the slug, prevents custom resources from impersonating application modules, and records creation, edits, assignment changes, and deletion attempts in the access-control audit stream. Do not place passwords, client secrets, financial account numbers, or unredacted personnel records in a custom page body.

| Recommended Business Management configuration | Value |
| --- | --- |
| Resource | Built-in **Business Management** module or a custom page under the Business Management navigation group. |
| Visibility | **Restricted**. |
| Primary assignment | An Entra group representing the approved Business Management audience. |
| Emergency fallback | Direct named-user assignment for a designated administrator or small interim team. |
| Review cadence | Review group membership, direct assignments, and page contents at least quarterly and after material role changes. |

## Entra group synchronization

For OpenID Connect sign-ins, Welfare Pride requests the delegated `GroupMember.Read.All` permission alongside the existing profile and SharePoint permissions. After a validated sign-in and token persistence, it retrieves the signed-in user’s direct group memberships from Microsoft Graph and stores only the Entra group object ID, display name, and synchronization time. Administrators may also select **Refresh Entra groups** from **Access & Pages** to refresh their own membership snapshot.

Microsoft recommends using Graph when group claims are unavailable or exceed token limits. Group object IDs are stable identifiers for authorization, while display names are shown only for administration.[1] Microsoft Graph’s `memberOf` endpoint returns direct memberships; nested groups are not expanded by this implementation.[2]

| Situation | Welfare Pride behavior |
| --- | --- |
| OIDC membership refresh succeeds | Replaces the user’s snapshot with current direct groups. |
| OIDC refresh fails or delegated consent is missing | Clears the user’s stored group snapshot and does **not** grant any group-restricted resource. Local and direct-user access remain available. |
| SAML assertion supplies group object-ID claims | Replaces the user’s group snapshot with the validated claim set. |
| SAML assertion does not supply group claims | Clears the snapshot; group-restricted resources remain unavailable until a valid group source is available. |
| Snapshot is older than 24 hours | Fails closed: it does not grant group-restricted access. |

## Microsoft Entra configuration checklist

Configure `GroupMember.Read.All` as a delegated Microsoft Graph permission, grant the required administrator consent, and include it in the OpenID Connect delegated scope. For a SAML application, configure the group claim to emit **group object IDs**. Group assignments in Welfare Pride must use the object ID, not a display name.

If an Entra group is renamed, access continues because authorization uses the object ID. If a group is deleted or a user is removed from it, the next successful synchronization removes the membership. The 24-hour freshness limit restricts the maximum reliance on a previously synchronized group assignment; organizations requiring faster removal should use a shorter interval or trigger a refresh at every sensitive-access event.

## Local-user fallback and future providers

The portal remains operable before Microsoft Entra is configured and during a temporary Entra outage. Administrators can grant direct named-user access to necessary pages. Local accounts follow the configured password policy and can be required to enroll time-based one-time password MFA through **Integration Settings → Local access**. The administrator can set the local MFA requirement for future and existing local accounts, while Microsoft Entra OIDC and SAML remain optional enterprise providers.

## References

[1] [Microsoft Entra ID token configuration: group claims and overage behavior](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims#configure-groups-optional-claims)

[2] [Microsoft Graph: List a user’s direct memberships](https://learn.microsoft.com/en-us/graph/api/user-list-memberof?view=graph-rest-1.0)
