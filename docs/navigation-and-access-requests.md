# Navigation, Restricted Resources, and Access Requests

## Sidebar behavior

The sidebar uses separated, plain-flow group headings and enlarged navigation controls so labels do not collide at narrow heights or widths. Navigation items are server-filtered; users see only portal resources for which the server has granted visibility. A lock icon appears beside an authorized resource when its policy is **Restricted**, communicating that access is controlled without disclosing resources that are unavailable to the signed-in user. Hovering or keyboard-focusing a restricted item presents the explanatory tooltip **“Restricted access managed by user or Entra group policy”**; equivalent text is announced to assistive technology.

## Business Management summary

Administrators receive a **Business Management access** widget on the dashboard. It summarizes whether the module is open to all authenticated employees or restricted, counts direct-user and Entra-group assignments, lists a bounded set of assignment names, and opens **Access & Pages** directly on the Business Management resource.

> The widget is an administrative convenience only. Business Management routes and procedures continue to enforce authorization on the server.

## Request-access workflow

When an authenticated employee visits a restricted Business Management or custom page through a direct link, the portal shows a dedicated restricted-access page. It does not reveal protected content. The employee may submit one optional message of up to 500 characters. The application records one pending request per user and resource, so repeated submissions do not generate duplicate review work.

Administrators review pending requests under **Access & Pages**. Approving a request adds a direct-user assignment to the requested portal resource and records an access-control audit event. Declining a request records the decision without granting access. Administrators should use Entra-group assignments instead of repeated individual approvals when access is intended for a durable team or department.

| Action | Who can perform it | Result |
| --- | --- | --- |
| Submit request | Authenticated user without resource access | Creates or confirms one pending request; no protected content is returned |
| Approve request | Administrator | Adds direct-user access and records the approval |
| Decline request | Administrator | Closes the request without changing resource access |
| Change group policy | Administrator | Updates the resource policy through Access & Pages; server checks apply immediately |

## Operational guidance

Use immutable Entra group object IDs for group assignments. Synchronized Entra membership snapshots expire after 24 hours and fail closed, so employees whose memberships change should refresh through Entra sign-in or **Refresh Entra groups** before requesting access. Review pending requests regularly, and remove no-longer-needed direct assignments after team changes.
