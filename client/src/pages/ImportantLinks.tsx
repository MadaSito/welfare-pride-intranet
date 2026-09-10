import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AppWindow, CalendarDays, ExternalLink, Link2, Mail, Pencil, Plus, Search, ShieldAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type LinkForm = { title: string; description: string; url: string; category: string; iconKey: string; actionLabel: string; sortOrder: number; isActive: boolean };
const emptyForm: LinkForm = { title: "", description: "", url: "", category: "Resources", iconKey: "link", actionLabel: "", sortOrder: 0, isActive: true };
const iconMap = { mail: Mail, apps: AppWindow, calendar: CalendarDays, users: Users, link: Link2 } as const;

export default function ImportantLinks() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const active = trpc.links.list.useQuery();
  const adminList = trpc.links.adminList.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const items = isAdmin ? (adminList.data || []) : (active.data || []);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LinkForm>(emptyForm);

  const create = trpc.links.create.useMutation({ onSuccess: async () => { await Promise.all([utils.links.list.invalidate(), utils.links.adminList.invalidate()]); toast.success("Important link added."); setEditorOpen(false); }, onError: error => toast.error(error.message) });
  const update = trpc.links.update.useMutation({ onSuccess: async () => { await Promise.all([utils.links.list.invalidate(), utils.links.adminList.invalidate()]); toast.success("Important link updated."); setEditorOpen(false); }, onError: error => toast.error(error.message) });
  const setActive = trpc.links.setActive.useMutation({ onSuccess: async () => { await Promise.all([utils.links.list.invalidate(), utils.links.adminList.invalidate()]); toast.success("Link status updated."); }, onError: error => toast.error(error.message) });

  const filtered = useMemo(() => items.filter(item => `${item.title} ${item.description || ""} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const grouped = useMemo(() => filtered.reduce<Record<string, typeof filtered>>((acc, item) => { (acc[item.category] ||= []).push(item); return acc; }, {}), [filtered]);

  function openEditor(item?: (typeof items)[number]) {
    if (!item) { setEditingId(null); setForm(emptyForm); }
    else setEditingId(item.id), setForm({ title: item.title, description: item.description || "", url: item.url, category: item.category, iconKey: item.iconKey, actionLabel: item.actionLabel || "", sortOrder: item.sortOrder, isActive: item.isActive });
    setEditorOpen(true);
  }
  function submit() { const values = { ...form, description: form.description || null, actionLabel: form.actionLabel || null }; if (editingId) update.mutate({ id: editingId, values }); else create.mutate(values); }

  return <div className="space-y-7">
    <PageHeader eyebrow="Your workday, one click away" title="Important Links" description="Open email, Microsoft 365 applications, the corporate calendar, and approved Welfare Pride resources." icon={Link2} actions={isAdmin ? <Button className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />Add link</Button> : undefined} />
    {(active.error || adminList.error) ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Important links could not be loaded</AlertTitle><AlertDescription>{active.error?.message || adminList.error?.message}</AlertDescription></Alert> : null}
    <Card className="border-0 shadow-soft"><CardContent className="p-4"><label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search email, apps, calendars, and resources" className="h-11 pl-10" /></label></CardContent></Card>
    {Object.keys(grouped).length ? Object.entries(grouped).map(([category, links]) => <section key={category} className="space-y-4"><div className="flex items-center gap-3"><h2 className="text-lg font-bold">{category}</h2><Badge variant="outline" className="border-[#5A92C9]/20 bg-[#5A92C9]/5 text-[#376F9F]">{links.length}</Badge></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{links.map(item => { const Icon = iconMap[item.iconKey as keyof typeof iconMap] || Link2; const action = item.actionLabel || `Open ${item.title}`; return <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${item.isActive ? "border-border" : "border-dashed border-[#D58240]/35 opacity-70"}`}><div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]"><Icon className="h-5 w-5" /></div>{isAdmin ? <div className="flex items-center gap-2"><Switch checked={item.isActive} onCheckedChange={checked => setActive.mutate({ id: item.id, isActive: checked })} aria-label={`Set ${item.title} active`} /><Button variant="ghost" size="icon" onClick={() => openEditor(item)} aria-label={`Edit ${item.title}`}><Pencil className="h-4 w-4" /></Button></div> : null}</div><h3 className="mt-5 font-bold">{item.title}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{item.description || "Open this approved Welfare Pride resource."}</p><Button asChild variant="outline" className="mt-4 border-[#5A92C9]/35 text-[#376F9F] hover:bg-[#5A92C9]/8 hover:text-[#2D5578]"><a href={item.url} target="_blank" rel="noreferrer">{action} <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button></article>; })}</div></section>) : <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white py-16 text-center"><Link2 className="mx-auto h-9 w-9 text-[#5A92C9]" /><h2 className="mt-4 font-bold">No links match this search</h2><p className="mt-2 text-sm text-muted-foreground">Try another term or ask an administrator to add an approved resource.</p></div>}
    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editingId ? "Edit important link" : "Add important link"}</DialogTitle><DialogDescription>Configure an approved Welfare Pride or Microsoft 365 resource.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Application name</Label><Input value={form.title} placeholder="Microsoft Teams" onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>URL</Label><Input type="url" value={form.url} onChange={event => setForm(current => ({ ...current, url: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Action button label</Label><Input value={form.actionLabel} placeholder={form.title ? `Open ${form.title}` : "Open application"} onChange={event => setForm(current => ({ ...current, actionLabel: event.target.value }))} /><p className="text-xs text-muted-foreground">If blank, the button defaults to “Open {form.title || "application"}”.</p></div><div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} /></div><div className="space-y-2"><Label>Icon</Label><select value={form.iconKey} onChange={event => setForm(current => ({ ...current, iconKey: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="link">Link</option><option value="mail">Email</option><option value="apps">Applications</option><option value="calendar">Calendar</option><option value="users">People</option></select></div><div className="space-y-2"><Label>Sort order</Label><Input type="number" min={0} value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: Number(event.target.value) }))} /></div><label className="flex items-center justify-between rounded-xl border border-border px-4 py-3"><span className="text-sm font-medium">Active</span><Switch checked={form.isActive} onCheckedChange={checked => setForm(current => ({ ...current, isActive: checked }))} /></label></div><DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!form.title || !form.url || !form.category || create.isPending || update.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">Save link</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
