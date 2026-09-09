import { describe, expect, it } from "vitest";
import { filterAccessRequests } from "../client/src/lib/accessRequestFilters";

const requests = [
  { id: 1, status: "pending", note: "Need access for monthly planning", requester: "Alex", resource: "Business Management" },
  { id: 2, status: "approved", note: "", requester: "Jordan", resource: "Business Management" },
  { id: 3, status: "declined", note: "Not in scope", requester: "Casey", resource: "Technology" },
];

describe("access request filters", () => {
  it("filters pending and resolved request states without mixing statuses", () => {
    expect(filterAccessRequests(requests, "pending", "", request => [request.requester, request.resource]).map(request => request.id)).toEqual([1]);
    expect(filterAccessRequests(requests, "approved", "", request => [request.requester, request.resource]).map(request => request.id)).toEqual([2]);
    expect(filterAccessRequests(requests, "all", "", request => [request.requester, request.resource])).toHaveLength(3);
  });

  it("matches requester, resource, and optional request-note text case-insensitively", () => {
    expect(filterAccessRequests(requests, "all", "planning", request => [request.requester, request.resource]).map(request => request.id)).toEqual([1]);
    expect(filterAccessRequests(requests, "all", "jordan", request => [request.requester, request.resource]).map(request => request.id)).toEqual([2]);
    expect(filterAccessRequests(requests, "all", "unknown", request => [request.requester, request.resource])).toEqual([]);
  });
});
