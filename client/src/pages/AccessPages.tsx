import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { filterAccessRequests } from "@/lib/accessRequestFilters";
import { ArrowDown, ArrowUp, CheckCircle2, FilePlus2, GripVertical, Loader2, LockKeyhole, Save, Search, ShieldAlert, SlidersHorizontal, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Assignment = { subjectType: "user"; userId: number } | { subjectType: "entra_group"; entraGroupId: string; displayName: string };
type ResourceForm = { id?: number; resourceType: "module" | "page" | "calendar"; resourceKey?: string; slug: string; label: string; navigationGroup: string; navigationGroupOrder: number; iconKey: string; body: string; calendarView: "all" | "events_only"; accessMode: "all_authenticated" | "restricted"; isPublished: boolean; sortOrder: number };
const blankPage: ResourceForm = { resourceType: "page", slug: "", label: "", navigationGroup: "Business Management", navigationGroupOrder: 0, iconKey: "file-text", body: "", calendarView: "all", accessMode: "restricted", isPublished: false, sortOrder: 200 };
const blankCalendar: ResourceForm = { resourceType: "calendar", slug: "", label: "", navigationGroup: "PA Health and Wellness", navigationGroupOrder: 0, iconKey: "calendar-days", body: "", calendarView: "all", accessMode: "all_authenticated", isPublished: false, sortOrder: 200 };

export default function AccessPages() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const overview = trpc.portalAccess.adminOverview.useQuery();
  const myGroups = trpc.portalAccess.myEntraGroups.useQuery();
  const [form, setForm] = useState<ResourceForm>(blankPage);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"all" | "pending" | "approved" | "declined">("pending");
  const [requestSearch, setRequestSearch] = useState("");
  const [draggedResourceId, setDraggedResourceId] = useState<number | null>(null);
  const assignmentsQuery = trpc.portalAccess.adminAssignments.useQuery({ resourceId: form.id || 1 }, { enabled: Boolean(form.id) });
  const save = trpc.portalAccess.saveResource.useMutation({ onSuccess: async resource => { await utils.portalAccess.adminOverview.invalidate(); await utils.portalAccess.navigation.invalidate(); setForm(current => ({ ...current, id: resource.id })); toast.success("Portal resource saved."); }, onError: error => toast.error(error.message) });
  const remove = trpc.portalAccess.deleteCustomResource.useMutation({ onSuccess: async () => { await utils.portalAccess.adminOverview.invalidate(); await utils.portalAccess.navigation.invalidate(); setForm(blankPage); setAssignments([]); toast.success("Custom page removed."); }, onError: error => toast.error(error.message) });
  const refreshMyGroups = trpc.portalAccess.refreshMyEntraGroups.useMutation({ onSuccess: async result => { await Promise.all([myGroups.refetch(), utils.portalAccess.adminOverview.invalidate(), utils.portalAccess.navigation.invalidate()]); toast.success(`${result.synchronized} Entra group${result.synchronized === 1 ? "" : "s"} synchronized.`); }, onError: error => toast.error(error.message) });
  const reviewRequest = trpc.portalAccess.reviewAccessRequest.useMutation({ onSuccess: async request => { await Promise.all([utils.portalAccess.adminOverview.invalidate(), utils.portalAccess.navigation.invalidate()]); toast.success(`Access request ${request.status}.`); }, onError: error => toast.error(error.message) });
  const reorder = trpc.portalAccess.reorderResources.useMutation({ onSuccess: async () => { await Promise.all([utils.portalAccess.adminOverview.invalidate(), utils.portalAccess.navigation.invalidate()]); toast.success("Portal resource order saved."); }, onError: error => toast.error(error.message) });
  const resources = overview.data?.resources || [];
  const users = overview.data?.users || [];
  const groups = overview.data?.groups || [];
  const accessRequests = overview.data?.accessRequests || [];
  const pendingRequests = accessRequests.filter(request => request.status === "pending");
  const filteredRequests = useMemo(() => filterAccessRequests(accessRequests, requestStatus, requestSearch, request => {
      const requester = users.find(user => user.id === request.requesterUserId);
      const resource = resources.find(item => item.id === request.resourceId);
      return [requester?.name, requester?.email, resource?.label];
    }), [accessRequests, requestSearch, requestStatus, resources, users]);
  const selected = useMemo(() => resources.find(resource => resource.id === form.id), [resources, form.id]);
  const requestedResourceKey = useMemo(() => new URLSearchParams(location.split("?")[1] || "").get("resource"), [location]);

  useEffect(() => {
    if (deepLinkApplied || !requestedResourceKey || !resources.length) return;
    const resource = resources.find(item => item.resourceKey === `module:${requestedResourceKey}` || item.resourceKey === requestedResourceKey);
    if (resource) selectResource(resource.id);
    setDeepLinkApplied(true);
  }, [deepLinkApplied, requestedResourceKey, resources]);

  useEffect(() => {
    if (new URLSearchParams(location.split("?")[1] || "").get("requests") === "all") setRequestStatus("all");
  }, [location]);

  useEffect(() => {
    if (!assignmentsQuery.data) return;
    const groupMap = new Map(groups.map(group => [group.groupId, group.displayName]));
    setAssignments(assignmentsQuery.data.reduce<Assignment[]>((current, item) => {
      if (item.userId) current.push({ subjectType: "user", userId: item.userId });
      if (item.entraGroupId) current.push({ subjectType: "entra_group", entraGroupId: item.entraGroupId, displayName: groupMap.get(item.entraGroupId) || item.entraGroupId });
      return current;
    }, []));
  }, [assignmentsQuery.data, groups]);

  function selectResource(id: number) {
    const resource = resources.find(item => item.id === id);
    if (!resource) return;
    setForm({ id: resource.id, resourceType: resource.resourceType, resourceKey: resource.resourceKey, slug: resource.path.startsWith("/pages/") ? resource.path.slice(7) : resource.path.startsWith("/calendars/") ? resource.path.slice(11) : "", label: resource.label, navigationGroup: resource.navigationGroup, navigationGroupOrder: resource.navigationGroupOrder, iconKey: resource.iconKey, body: resource.body || "", calendarView: resource.calendarView, accessMode: resource.accessMode, isPublished: resource.isPublished, sortOrder: resource.sortOrder });
    setAssignments([]);
  }

  function addUser(userId: string) {
    const parsed = Number(userId);
    if (!parsed || assignments.some(item => item.subjectType === "user" && item.userId === parsed)) return;
    setAssignments(current => [...current, { subjectType: "user", userId: parsed }]);
  }

  function addGroup() {
    const id = groupId.trim(); const name = groupName.trim() || groups.find(group => group.groupId === id)?.displayName || "";
    if (!id || !name || assignments.some(item => item.subjectType === "entra_group" && item.entraGroupId === id)) return;
    setAssignments(current => [...current, { subjectType: "entra_group", entraGroupId: id, displayName: name }]); setGroupId(""); setGroupName("");
  }

  function submit() {
    save.mutate({ ...form, resourceKey: form.resourceType === "module" ? form.resourceKey : undefined, slug: form.resourceType === "page" ? form.slug : undefined, body: form.body || null, assignments });
  }

  function persistResourceOrder(next: typeof resources) {
    const groupOrder = Array.from(new Set(next.map(item => item.navigationGroup)));
    const counters = new Map<string, number>();
    reorder.mutate({ items: next.map(item => { const sortOrder = counters.get(item.navigationGroup) || 0; counters.set(item.navigationGroup, sortOrder + 10); return { id: item.id, navigationGroup: item.navigationGroup, navigationGroupOrder: groupOrder.indexOf(item.navigationGroup) * 10, sortOrder }; }) });
  }
  function moveResource(resourceId: number, direction: -1 | 1) {
    const index = resources.findIndex(item => item.id === resourceId); const target = index + direction;
    if (index < 0 || target < 0 || target >= resources.length) return;
    const next = [...resources]; [next[index], next[target]] = [next[target], next[index]]; persistResourceOrder(next);
  }
  function dropResource(targetId: number) {
    if (!draggedResourceId || draggedResourceId === targetId) return;
    const source = resources.find(item => item.id === draggedResourceId); const target = resources.find(item => item.id === targetId);
    if (!source || !target) return;
    const next = resources.filter(item => item.id !== source.id); const targetIndex = next.findIndex(item => item.id === target.id);
    next.splice(targetIndex, 0, { ...source, navigationGroup: target.navigationGroup }); persistResourceOrder(next); setDraggedResourceId(null);
  }

  return <div className="space-y-7">
    <PageHeader eyebrow="Administration" title="Access & Pages" description="Create editable pages and calendar pages, then assign them to named users or Microsoft Entra security groups. Server-side checks enforce every restriction." icon={LockKeyhole} actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setForm(blankCalendar); setAssignments([]); }}><FilePlus2 className="mr-2 h-4 w-4" />New calendar page</Button><Button onClick={() => { setForm(blankPage); setAssignments([]); }} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><FilePlus2 className="mr-2 h-4 w-4" />New editable page</Button></div>} />
    <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>Entra group availability</AlertTitle><AlertDescription>Groups appear here after an Entra user signs in with the required delegated group-membership permission, or may be entered by object ID. Group display names are informational; authorization uses immutable Entra object IDs.</AlertDescription></Alert>
    {overview.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Access configuration could not load</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}
    <Card className="border-0 shadow-soft"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Your Microsoft Entra memberships</p><p className="mt-1 text-sm text-muted-foreground">{myGroups.data?.groups.length ? myGroups.data.groups.map(group => group.displayName).join(", ") : "No synchronized groups are available for this account yet."}</p></div><Button variant="outline" onClick={() => refreshMyGroups.mutate()} disabled={refreshMyGroups.isPending}>{refreshMyGroups.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UsersRound className="mr-2 h-4 w-4" />}Refresh Entra groups</Button></CardContent></Card>
    <Card className="border-0 shadow-soft"><CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/70"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#D58240]">Access requests</p><CardTitle className="mt-1">Pending review</CardTitle><p className="mt-1 text-sm text-muted-foreground">Approving a request grants direct access to the selected portal resource and records the decision.</p></div><Badge variant="outline" className="border-[#D58240]/30 bg-[#D58240]/5 text-[#9A5727]">{pendingRequests.length} pending</Badge></CardHeader><CardContent className="p-4">{pendingRequests.length ? <div className="space-y-3">{pendingRequests.map(request => { const requester = users.find(user => user.id === request.requesterUserId); const resource = resources.find(item => item.id === request.resourceId); return <div key={request.id} className="rounded-xl border border-border/80 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{requester?.name || requester?.email || `User ${request.requesterUserId}`} <span className="font-normal text-muted-foreground">requested</span> {resource?.label || "a restricted resource"}</p><p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(request.createdAt).toLocaleString()}</p>{request.note ? <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm leading-6 text-muted-foreground">{request.note}</p> : null}</div><div className="flex gap-2"><Button size="sm" className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" disabled={reviewRequest.isPending} onClick={() => reviewRequest.mutate({ requestId: request.id, status: "approved" })}><CheckCircle2 className="mr-1.5 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" disabled={reviewRequest.isPending} onClick={() => reviewRequest.mutate({ requestId: request.id, status: "declined" })}><X className="mr-1.5 h-4 w-4" />Decline</Button></div></div></div>; })}</div> : <div className="rounded-xl border border-dashed border-[#5A92C9]/25 bg-[#5A92C9]/5 p-5 text-center text-sm text-muted-foreground">There are no pending access requests.</div>}</CardContent></Card>
    <Card className="border-0 shadow-soft"><CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5A92C9]">Request manager</p><CardTitle className="mt-1">Search and filter access requests</CardTitle><p className="mt-1 text-sm text-muted-foreground">Review open work or audit resolved decisions without leaving Access & Pages.</p></div><Badge variant="outline" className="self-start border-[#5A92C9]/25 bg-[#5A92C9]/5 text-[#376F9F]">{filteredRequests.length} shown</Badge></CardHeader><CardContent className="space-y-4 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={requestSearch} onChange={event => setRequestSearch(event.target.value)} className="h-11 pl-9" placeholder="Search employee, page, or request note" aria-label="Search access requests" /></div><Select value={requestStatus} onValueChange={value => setRequestStatus(value as typeof requestStatus)}><SelectTrigger className="h-11"><SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="declined">Declined</SelectItem><SelectItem value="all">All requests</SelectItem></SelectContent></Select></div>{filteredRequests.length ? <div className="divide-y divide-border rounded-xl border border-border/80">{filteredRequests.map(request => { const requester = users.find(user => user.id === request.requesterUserId); const resource = resources.find(item => item.id === request.resourceId); const statusClass = request.status === "pending" ? "border-[#D58240]/30 bg-[#D58240]/5 text-[#9A5727]" : request.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-muted/50 text-muted-foreground"; return <div key={request.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{requester?.name || requester?.email || `User ${request.requesterUserId}`}</p><Badge variant="outline" className={statusClass}>{request.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{resource?.label || "Restricted resource"} · submitted {new Date(request.createdAt).toLocaleString()}</p>{request.note ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{request.note}</p> : null}{request.reviewedAt ? <p className="mt-2 text-xs text-muted-foreground">Resolved {new Date(request.reviewedAt).toLocaleString()}</p> : null}</div>{request.status === "pending" ? <div className="flex shrink-0 gap-2"><Button size="sm" className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" disabled={reviewRequest.isPending} onClick={() => reviewRequest.mutate({ requestId: request.id, status: "approved" })}>Approve</Button><Button size="sm" variant="outline" disabled={reviewRequest.isPending} onClick={() => reviewRequest.mutate({ requestId: request.id, status: "declined" })}>Decline</Button></div> : null}</div>; })}</div> : <div className="rounded-xl border border-dashed border-[#5A92C9]/25 bg-[#5A92C9]/5 p-6 text-center text-sm text-muted-foreground">No requests match the selected search and status filters.</div>}</CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.4fr]">
      <Card className="border-0 shadow-soft"><CardHeader><CardTitle>Portal resources</CardTitle><p className="mt-1 text-sm text-muted-foreground">Drag a resource to reorder it or move it into another navigation section. Use arrow controls for a keyboard-accessible alternative. Create an additional section by entering a new Navigation group name when editing a resource.</p></CardHeader><CardContent className="space-y-2">{overview.isLoading ? <p className="text-sm text-muted-foreground">Loading resources…</p> : resources.map((resource, index) => <div key={resource.id} draggable onDragStart={() => setDraggedResourceId(resource.id)} onDragEnd={() => setDraggedResourceId(null)} onDragOver={event => event.preventDefault()} onDrop={() => dropResource(resource.id)} className={`group flex rounded-xl border transition-colors ${form.id === resource.id ? "border-[#5A92C9]/45 bg-[#5A92C9]/8" : "border-border hover:bg-muted/60"}`}><button type="button" onClick={() => selectResource(resource.id)} className="min-w-0 flex-1 p-3 text-left"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{resource.label}</p><Badge variant="outline" className={resource.accessMode === "restricted" ? "border-[#D58240]/30 text-[#9A5727]" : "border-emerald-200 text-emerald-700"}>{resource.accessMode === "restricted" ? "Restricted" : "All users"}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{resource.navigationGroup} · {resource.path} · {resource.isSystem ? "module" : "custom page"}</p></button><div className="flex items-center gap-0.5 pr-2"><GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0 || reorder.isPending} onClick={() => moveResource(resource.id, -1)} aria-label={`Move ${resource.label} up`}><ArrowUp className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === resources.length - 1 || reorder.isPending} onClick={() => moveResource(resource.id, 1)} aria-label={`Move ${resource.label} down`}><ArrowDown className="h-3.5 w-3.5" /></Button></div></div>)}</CardContent></Card>
      <Card className="border-0 shadow-soft"><CardHeader><CardTitle>{form.id ? `Edit ${selected?.label || "resource"}` : "Create custom page"}</CardTitle></CardHeader><CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Label</Label><Input value={form.label} onChange={event => setForm(current => ({ ...current, label: event.target.value }))} /></div><div className="space-y-2"><Label>Navigation group</Label><Input value={form.navigationGroup} onChange={event => setForm(current => ({ ...current, navigationGroup: event.target.value }))} /></div></div>
        {form.resourceType === "page" || form.resourceType === "calendar" ? <div className="space-y-2"><Label>{form.resourceType === "calendar" ? "Calendar slug" : "Page slug"}</Label><Input value={form.slug} placeholder={form.resourceType === "calendar" ? "wellness-calendar" : "business-operations"} onChange={event => setForm(current => ({ ...current, slug: event.target.value.toLowerCase() }))} /><p className="text-xs text-muted-foreground">Publishes at `{form.resourceType === "calendar" ? "/calendars" : "/pages"}/{form.slug || "your-page"}`.</p></div> : <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">System module path: <code>{selected?.path}</code>. Its identity cannot be changed.</div>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Icon key</Label><Input value={form.iconKey} onChange={event => setForm(current => ({ ...current, iconKey: event.target.value }))} /></div><div className="space-y-2"><Label>Sort order</Label><Input type="number" value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div></div>
        {form.resourceType === "calendar" ? <div className="space-y-4 rounded-xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-4"><div className="space-y-2"><Label>Calendar view</Label><Select value={form.calendarView} onValueChange={value => setForm(current => ({ ...current, calendarView: value as ResourceForm["calendarView"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Holidays, birthdays, and events</SelectItem><SelectItem value="events_only">Events only</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Calendar guidance</Label><Textarea className="min-h-28" value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Optional guidance displayed above this calendar…" /></div></div> : <div className="space-y-2"><Label>Page content</Label><Textarea className="min-h-44" value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Plain text workspace guidance, procedures, and contacts…" /><p className="text-xs text-muted-foreground">Content is rendered as plain text; scripts and raw HTML are not accepted.</p></div>}
        <div className="flex flex-wrap gap-5 rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-3"><Switch checked={form.isPublished} onCheckedChange={checked => setForm(current => ({ ...current, isPublished: checked }))} /><div><p className="text-sm font-semibold">Published</p><p className="text-xs text-muted-foreground">Show to authorized users.</p></div></div><div className="flex items-center gap-3"><Switch checked={form.accessMode === "restricted"} onCheckedChange={checked => setForm(current => ({ ...current, accessMode: checked ? "restricted" : "all_authenticated" }))} /><div><p className="text-sm font-semibold">Restricted</p><p className="text-xs text-muted-foreground">Require assigned user or Entra group.</p></div></div></div>
        {form.accessMode === "restricted" ? <div className="space-y-4 rounded-xl border border-[#D58240]/25 bg-[#D58240]/5 p-4"><div><p className="font-semibold">Assignments</p><p className="mt-1 text-xs text-muted-foreground">At least one assignment is required before a restricted resource can be saved.</p></div><div className="grid gap-3 sm:grid-cols-2"><Select onValueChange={addUser}><SelectTrigger><SelectValue placeholder="Add portal user" /></SelectTrigger><SelectContent>{users.map(user => <SelectItem key={user.id} value={String(user.id)}>{user.name || user.email || `User ${user.id}`}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Select value={groupId || undefined} onValueChange={value => { setGroupId(value); setGroupName(groups.find(group => group.groupId === value)?.displayName || ""); }}><SelectTrigger><SelectValue placeholder="Known Entra group" /></SelectTrigger><SelectContent>{groups.map(group => <SelectItem key={group.groupId} value={group.groupId}>{group.displayName}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={addGroup}>Add</Button></div></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input value={groupId} onChange={event => setGroupId(event.target.value)} placeholder="Entra group object ID" /><Input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Group display name" /><Button type="button" variant="outline" onClick={addGroup}>Add group</Button></div><div className="flex flex-wrap gap-2">{assignments.map((assignment, index) => { const label = assignment.subjectType === "user" ? users.find(user => user.id === assignment.userId)?.email || `User ${assignment.userId}` : assignment.displayName; return <Badge key={`${assignment.subjectType}-${index}`} variant="outline" className="gap-1.5 border-[#5A92C9]/30 bg-white py-1.5 pl-2.5 text-[#376F9F]">{assignment.subjectType === "user" ? <UsersRound className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{label}<button type="button" aria-label={`Remove ${label}`} onClick={() => setAssignments(current => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3.5 w-3.5" /></button></Badge>; })}</div></div> : null}
        <div className="flex flex-wrap justify-between gap-3"><div>{form.id && !selected?.isSystem ? <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => remove.mutate({ id: form.id! })} disabled={remove.isPending}><Trash2 className="mr-2 h-4 w-4" />Delete resource</Button> : null}</div><Button onClick={submit} disabled={save.isPending || !form.label || ((form.resourceType === "page" || form.resourceType === "calendar") && !form.slug) || (form.accessMode === "restricted" && assignments.length === 0)} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save access policy</Button></div>
      </CardContent></Card>
    </div>
  </div>;
}
