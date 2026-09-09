export type AccessRequestStatusFilter = "all" | "pending" | "approved" | "declined";

export function filterAccessRequests<T extends { status: string; note?: string | null }>(
  requests: T[],
  status: AccessRequestStatusFilter,
  query: string,
  searchableText: (request: T) => Array<string | null | undefined>,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return requests.filter(request => {
    if (status !== "all" && request.status !== status) return false;
    if (!normalizedQuery) return true;
    return [...searchableText(request), request.note]
      .filter(Boolean)
      .some(value => String(value).toLocaleLowerCase().includes(normalizedQuery));
  });
}
