# Administrator Access-Request Notifications

## Notification bell

When an employee submits a new request for a restricted page, the portal creates one notification for each current administrator. The header bell is visible only to administrators. It displays an unread count, lists recent requests, and marks the signed-in administrator’s notifications as read when the list is opened. Standard users cannot query, view, or modify administrator notifications.

> Notification delivery is per administrator. Reading a notification changes only that administrator’s read state and does not affect another administrator’s queue.

## Request management

Administrators can select **Manage access requests** from the bell or open **Access & Pages** directly. The request manager supports text search across requester name, requester email, resource name, and the employee’s optional request note. The status filter supports **Pending**, **Approved**, **Declined**, and **All requests**.

The Business Management dashboard widget also includes a compact search and Pending/Resolved filter. It is intended for a quick operational review; the full management screen remains the authoritative place to approve or decline requests.

| Action | Outcome |
| --- | --- |
| Open bell | Shows recent administrator-scoped notifications and clears that administrator’s unread count. |
| Search/filter | Narrows the displayed request history without changing authorization data. |
| Approve | Grants a direct-user assignment to the requested resource and writes an audit event. |
| Decline | Records the decision and leaves resource assignments unchanged. |

## Mobile navigation

The sidebar uses a viewport-bounded width, block-level category labels, larger spacing between sections, and light active button states. Category labels have their own tinted background and ring treatment, separating them from navigation rows. Authorized restricted items retain their lock marker and focus/hover explanation. Users still receive only server-filtered resources, so neither the category treatment nor the lock marker discloses unavailable pages.

## Operational review

Review pending requests regularly and prefer Entra group assignments for durable department or team access. Treat direct-user grants as exceptions. If multiple administrators process requests, notifications make new work visible to each administrator, while the request’s server-side status prevents a duplicate approval from creating duplicate access.

