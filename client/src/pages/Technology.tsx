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
import { ExternalLink, Laptop, Pencil, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type EmbedForm = { title: string; description: string; url: string; allowedHostname: string; sortOrder: number; isActive: boolean };
const emptyForm: EmbedForm = { title: "", description: "", url: "", allowedHostname: "", sortOrder: 0, isActive: true };

export default function Technology() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const active = trpc.technology.list.useQuery();
  const adminList = trpc.technology.adminList.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const items = isAdmin ? (adminList.data || []) : (active.data || []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EmbedForm>(emptyForm);
  const selected = items.find(item => item.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const create = trpc.technology.create.useMutation({ onSuccess: async () => { await Promise.all([utils.technology.list.invalidate(), utils.technology.adminList.invalidate()]); toast.success("Technology application added."); setEditorOpen(false); }, onError: error => toast.error(error.message) });
  const update = trpc.technology.update.useMutation({ onSuccess: async () => { await Promise.all([utils.technology.list.invalidate(), utils.technology.adminList.invalidate()]); toast.success("Technology application updated."); setEditorOpen(false); }, onError: error => toast.error(error.message) });
  const setActive = trpc.technology.setActive.useMutation({ onSuccess: async () => { await Promise.all([utils.technology.list.invalidate(), utils.technology.adminList.invalidate()]); toast.success("Application status updated."); }, onError: error => toast.error(error.message) });

  function openEditor(item?: (typeof items)[number]) {
    if (!item) { setEditingId(null); setForm(emptyForm); }
    else { setEditingId(item.id); setForm({ title: item.title, description: item.description || "", url: item.url, allowedHostname: item.allowedHostname, sortOrder: item.sortOrder, isActive: item.isActive }); }
    setEditorOpen(true);
  }

  function submit() {
    const values = { ...form, description: form.description || null };
    if (editingId) update.mutate({ id: editingId, values }); else create.mutate(values);
  }

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Use approved work tools" title="Technology" description="Launch Welfare Pride internal applications through an HTTPS-only, allowlisted, and sandboxed embed workspace." icon={Laptop} actions={isAdmin ? <Button onClick={() => openEditor()} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><Plus className="mr-2 h-4 w-4" />Add application</Button> : undefined} />
      {(active.error || adminList.error) ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Technology applications could not be loaded</AlertTitle><AlertDescription>{active.error?.message || adminList.error?.message}</AlertDescription></Alert> : null}

      {items.length ? (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <Card className="border-0 shadow-soft"><CardContent className="p-3"><p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.15em] text-[#D58240]">Approved applications</p><div className="space-y-1">{items.map(item => <div key={item.id} className={`group rounded-xl border p-3 ${selectedId === item.id ? "border-[#5A92C9]/30 bg-[#5A92C9]/8" : "border-transparent hover:bg-muted/60"}`}><button onClick={() => setSelectedId(item.id)} className="w-full text-left"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{item.title}</span>{!item.isActive ? <Badge variant="outline" className="text-[9px]">Inactive</Badge> : null}</div><p className="mt-1 truncate text-xs text-muted-foreground">{item.allowedHostname}</p></button>{isAdmin ? <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2"><Switch checked={item.isActive} onCheckedChange={checked => setActive.mutate({ id: item.id, isActive: checked })} aria-label={`Set ${item.title} active`} /><Button variant="ghost" size="sm" onClick={() => openEditor(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button></div> : null}</div>)}</div></CardContent></Card>
          <Card className="overflow-hidden border-0 shadow-soft">{selected ? <><div className="flex flex-col gap-3 border-b border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{selected.title}</h2><Badge variant="outline" className="border-[#5A92C9]/20 bg-[#5A92C9]/5 text-[10px] text-[#376F9F]"><ShieldCheck className="mr-1 h-3 w-3" />{selected.allowedHostname}</Badge></div>{selected.description ? <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p> : null}</div><Button asChild variant="outline" size="sm"><a href={selected.url} target="_blank" rel="noreferrer">Open separately <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></div>{selected.isActive ? <div className="relative h-[660px] bg-muted/40"><iframe key={selected.id} src={selected.url} title={`${selected.title} embedded application`} className="h-full w-full border-0" sandbox="allow-scripts allow-forms allow-popups allow-downloads" referrerPolicy="no-referrer" loading="lazy" allow="clipboard-read; clipboard-write" /></div> : <div className="flex h-[500px] items-center justify-center p-8 text-center"><div><ShieldAlert className="mx-auto h-9 w-9 text-[#D58240]" /><h3 className="mt-4 font-bold">This application is inactive</h3><p className="mt-2 text-sm text-muted-foreground">An administrator can reactivate the approved embed when it is ready for employee use.</p></div></div>}</> : null}</Card>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white py-20 text-center"><Laptop className="mx-auto h-9 w-9 text-[#5A92C9]" /><h2 className="mt-4 font-bold">No Technology applications are configured</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Administrators can add approved HTTPS applications and an exact hostname allowlist. The portal applies a restrictive iframe sandbox by default.</p>{isAdmin ? <Button className="mt-5 bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />Add first application</Button> : null}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-[#5A92C9]/5 p-5"><p className="text-sm font-bold">HTTPS required</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Insecure URLs, embedded credentials, local hosts, and private network addresses are rejected by the server.</p></div><div className="rounded-2xl bg-[#5A92C9]/5 p-5"><p className="text-sm font-bold">Exact hostname allowlist</p><p className="mt-2 text-xs leading-5 text-muted-foreground">The submitted URL hostname must exactly match the administrator-approved hostname.</p></div><div className="rounded-2xl bg-[#5A92C9]/5 p-5"><p className="text-sm font-bold">Restrictive sandbox</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Embedded applications do not receive same-origin privileges. Some applications may require opening in a separate tab.</p></div></div>
      {isAdmin ? <Alert className="border-[#5A92C9]/25 bg-[#5A92C9]/5"><ShieldCheck className="h-4 w-4 text-[#5A92C9]" /><AlertTitle>Production Content Security Policy review</AlertTitle><AlertDescription>For each active application, add its exact HTTPS origin to the production <code className="rounded bg-white px-1 py-0.5">frame-src</code> directive. If the external application blocks framing with <code className="rounded bg-white px-1 py-0.5">frame-ancestors</code> or <code className="rounded bg-white px-1 py-0.5">X-Frame-Options</code>, use “Open separately” rather than weakening portal security.</AlertDescription></Alert> : null}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editingId ? "Edit Technology application" : "Add Technology application"}</DialogTitle><DialogDescription>Only add an application after its owner has approved embedding and configured compatible frame policies.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-2"><Label>Application name</Label><Input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div><div className="space-y-2"><Label>HTTPS embed URL</Label><Input type="url" placeholder="https://app.example.org/" value={form.url} onChange={event => { const value = event.target.value; let hostname = form.allowedHostname; try { hostname = new URL(value).hostname; } catch { /* keep current value */ } setForm(current => ({ ...current, url: value, allowedHostname: hostname })); }} /></div><div className="space-y-2"><Label>Approved hostname</Label><Input placeholder="app.example.org" value={form.allowedHostname} onChange={event => setForm(current => ({ ...current, allowedHostname: event.target.value }))} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Sort order</Label><Input type="number" min={0} value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: Number(event.target.value) }))} /></div><label className="flex items-center justify-between rounded-xl border border-border px-4 py-3"><span className="text-sm font-medium">Active</span><Switch checked={form.isActive} onCheckedChange={checked => setForm(current => ({ ...current, isActive: checked }))} /></label></div></div><DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!form.title || !form.url || !form.allowedHostname || create.isPending || update.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">Save application</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
