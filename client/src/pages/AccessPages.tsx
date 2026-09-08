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
import { CheckCircle2, FilePlus2, Loader2, LockKeyhole, Save, ShieldAlert, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Assignment = { subjectType: "user"; userId: number } | { subjectType: "entra_group"; entraGroupId: string; displayName: string };
type ResourceForm = { id?: number; resourceType: "module" | "page"; resourceKey?: string; slug: string; label: string; navigationGroup: string; iconKey: string; body: string; accessMode: "all_authenticated" | "restricted"; isPublished: boolean; sortOrder: number };
const blankPage: ResourceForm = { resourceType: "page", slug: "", label: "", navigationGroup: "Business Management", iconKey: "file-text", body: "", accessMode: "restricted", isPublished: false, sortOrder: 200 };

export default function AccessPages() {
  const utils = trpc.useUtils();
  const overview = trpc.portalAccess.adminOverview.useQuery();
  const myGroups = trpc.portalAccess.myEntraGroups.useQuery();
  const [form, setForm] = useState<ResourceForm>(blankPage);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const assignmentsQuery = trpc.portalAccess.adminAssignments.useQuery({ resourceId: form.id || 1 }, { enabled: Boolean(form.id) });
  const save = trpc.portalAccess.saveResource.useMutation({ onSuccess: async resource => { await utils.portalAccess.adminOverview.invalidate(); await utils.portalAccess.navigation.invalidate(); setForm(current => ({ ...current, id: resource.id })); toast.success("Page access policy saved."); }, onError: error => toast.error(error.message) });
  const remove = trpc.portalAccess.deleteCustomResource.useMutation({ onSuccess: async () => { await utils.portalAccess.adminOverview.invalidate(); await utils.portalAccess.navigation.invalidate(); setForm(blankPage); setAssignments([]); toast.success("Custom page removed."); }, onError: error => toast.error(error.message) });
  const refreshMyGroups = trpc.portalAccess.refreshMyEntraGroups.useMutation({ onSuccess: async result => { await Promise.all([myGroups.refetch(), utils.portalAccess.adminOverview.invalidate(), utils.portalAccess.navigation.invalidate()]); toast.success(`${result.synchronized} Entra group${result.synchronized === 1 ? "" : "s"} synchronized.`); }, onError: error => toast.error(error.message) });
  const resources = overview.data?.resources || [];
  const users = overview.data?.users || [];
  const groups = overview.data?.groups || [];
  const selected = useMemo(() => resources.find(resource => resource.id === form.id), [resources, form.id]);

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
    setForm({ id: resource.id, resourceType: resource.resourceType, resourceKey: resource.resourceKey, slug: resource.path.startsWith("/pages/") ? resource.path.slice(7) : "", label: resource.label, navigationGroup: resource.navigationGroup, iconKey: resource.iconKey, body: resource.body || "", accessMode: resource.accessMode, isPublished: resource.isPublished, sortOrder: resource.sortOrder });
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

  return <div className="space-y-7">
    <PageHeader eyebrow="Administration" title="Access & Pages" description="Create pages and Business Management content, then assign them to named users or Microsoft Entra security groups. Server-side checks enforce every restriction." icon={LockKeyhole} actions={<Button onClick={() => { setForm(blankPage); setAssignments([]); }} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><FilePlus2 className="mr-2 h-4 w-4" />New custom page</Button>} />
    <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>Entra group availability</AlertTitle><AlertDescription>Groups appear here after an Entra user signs in with the required delegated group-membership permission, or may be entered by object ID. Group display names are informational; authorization uses immutable Entra object IDs.</AlertDescription></Alert>
    {overview.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Access configuration could not load</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}
    <Card className="border-0 shadow-soft"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Your Microsoft Entra memberships</p><p className="mt-1 text-sm text-muted-foreground">{myGroups.data?.groups.length ? myGroups.data.groups.map(group => group.displayName).join(", ") : "No synchronized groups are available for this account yet."}</p></div><Button variant="outline" onClick={() => refreshMyGroups.mutate()} disabled={refreshMyGroups.isPending}>{refreshMyGroups.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UsersRound className="mr-2 h-4 w-4" />}Refresh Entra groups</Button></CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.4fr]">
      <Card className="border-0 shadow-soft"><CardHeader><CardTitle>Portal resources</CardTitle></CardHeader><CardContent className="space-y-2">{overview.isLoading ? <p className="text-sm text-muted-foreground">Loading resources…</p> : resources.map(resource => <button key={resource.id} onClick={() => selectResource(resource.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${form.id === resource.id ? "border-[#5A92C9]/45 bg-[#5A92C9]/8" : "border-border hover:bg-muted/60"}`}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{resource.label}</p><Badge variant="outline" className={resource.accessMode === "restricted" ? "border-[#D58240]/30 text-[#9A5727]" : "border-emerald-200 text-emerald-700"}>{resource.accessMode === "restricted" ? "Restricted" : "All users"}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{resource.path} · {resource.isSystem ? "module" : "custom page"}</p></button>)}</CardContent></Card>
      <Card className="border-0 shadow-soft"><CardHeader><CardTitle>{form.id ? `Edit ${selected?.label || "resource"}` : "Create custom page"}</CardTitle></CardHeader><CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Label</Label><Input value={form.label} onChange={event => setForm(current => ({ ...current, label: event.target.value }))} /></div><div className="space-y-2"><Label>Navigation group</Label><Input value={form.navigationGroup} onChange={event => setForm(current => ({ ...current, navigationGroup: event.target.value }))} /></div></div>
        {form.resourceType === "page" ? <div className="space-y-2"><Label>Page slug</Label><Input value={form.slug} placeholder="business-operations" onChange={event => setForm(current => ({ ...current, slug: event.target.value.toLowerCase() }))} /><p className="text-xs text-muted-foreground">Publishes at `/pages/{form.slug || "your-page"}`.</p></div> : <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">System module path: <code>{selected?.path}</code>. Its identity cannot be changed.</div>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Icon key</Label><Input value={form.iconKey} onChange={event => setForm(current => ({ ...current, iconKey: event.target.value }))} /></div><div className="space-y-2"><Label>Sort order</Label><Input type="number" value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></div></div>
        <div className="space-y-2"><Label>Page content</Label><Textarea className="min-h-44" value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Plain text workspace guidance, procedures, and contacts…" /><p className="text-xs text-muted-foreground">Content is rendered as plain text; scripts and raw HTML are not accepted.</p></div>
        <div className="flex flex-wrap gap-5 rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-3"><Switch checked={form.isPublished} onCheckedChange={checked => setForm(current => ({ ...current, isPublished: checked }))} /><div><p className="text-sm font-semibold">Published</p><p className="text-xs text-muted-foreground">Show to authorized users.</p></div></div><div className="flex items-center gap-3"><Switch checked={form.accessMode === "restricted"} onCheckedChange={checked => setForm(current => ({ ...current, accessMode: checked ? "restricted" : "all_authenticated" }))} /><div><p className="text-sm font-semibold">Restricted</p><p className="text-xs text-muted-foreground">Require assigned user or Entra group.</p></div></div></div>
        {form.accessMode === "restricted" ? <div className="space-y-4 rounded-xl border border-[#D58240]/25 bg-[#D58240]/5 p-4"><div><p className="font-semibold">Assignments</p><p className="mt-1 text-xs text-muted-foreground">At least one assignment is required before a restricted resource can be saved.</p></div><div className="grid gap-3 sm:grid-cols-2"><Select onValueChange={addUser}><SelectTrigger><SelectValue placeholder="Add portal user" /></SelectTrigger><SelectContent>{users.map(user => <SelectItem key={user.id} value={String(user.id)}>{user.name || user.email || `User ${user.id}`}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Select value={groupId || undefined} onValueChange={value => { setGroupId(value); setGroupName(groups.find(group => group.groupId === value)?.displayName || ""); }}><SelectTrigger><SelectValue placeholder="Known Entra group" /></SelectTrigger><SelectContent>{groups.map(group => <SelectItem key={group.groupId} value={group.groupId}>{group.displayName}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={addGroup}>Add</Button></div></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input value={groupId} onChange={event => setGroupId(event.target.value)} placeholder="Entra group object ID" /><Input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Group display name" /><Button type="button" variant="outline" onClick={addGroup}>Add group</Button></div><div className="flex flex-wrap gap-2">{assignments.map((assignment, index) => { const label = assignment.subjectType === "user" ? users.find(user => user.id === assignment.userId)?.email || `User ${assignment.userId}` : assignment.displayName; return <Badge key={`${assignment.subjectType}-${index}`} variant="outline" className="gap-1.5 border-[#5A92C9]/30 bg-white py-1.5 pl-2.5 text-[#376F9F]">{assignment.subjectType === "user" ? <UsersRound className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{label}<button type="button" aria-label={`Remove ${label}`} onClick={() => setAssignments(current => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3.5 w-3.5" /></button></Badge>; })}</div></div> : null}
        <div className="flex flex-wrap justify-between gap-3"><div>{form.id && !selected?.isSystem ? <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => remove.mutate({ id: form.id! })} disabled={remove.isPending}><Trash2 className="mr-2 h-4 w-4" />Delete page</Button> : null}</div><Button onClick={submit} disabled={save.isPending || !form.label || (form.resourceType === "page" && !form.slug) || (form.accessMode === "restricted" && assignments.length === 0)} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save access policy</Button></div>
      </CardContent></Card>
    </div>
  </div>;
}
