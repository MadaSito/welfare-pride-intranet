import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowRight, CalendarClock, Megaphone, Pencil, Pin, Plus, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AnnouncementForm = {
  title: string;
  summary: string;
  body: string;
  category: string;
  status: "draft" | "published" | "archived";
  isPinned: boolean;
  publishAt: string;
  expiresAt: string;
};

const emptyForm: AnnouncementForm = {
  title: "",
  summary: "",
  body: "",
  category: "Company",
  status: "draft",
  isPinned: false,
  publishAt: "",
  expiresAt: "",
};

export default function Announcements() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const published = trpc.announcements.list.useQuery();
  const adminList = trpc.announcements.adminList.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const items = isAdmin ? (adminList.data || []) : (published.data || []);
  const detail = items.find(item => item.id === detailId) || null;
  const deepLinkedAnnouncementId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const value = Number(new URLSearchParams(window.location.search).get("announcement"));
    return Number.isInteger(value) && value > 0 ? value : null;
  }, []);

  useEffect(() => {
    if (deepLinkedAnnouncementId && items.some(item => item.id === deepLinkedAnnouncementId)) setDetailId(deepLinkedAnnouncementId);
  }, [deepLinkedAnnouncementId, items]);

  const create = trpc.announcements.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.announcements.list.invalidate(), utils.announcements.adminList.invalidate()]);
      toast.success("Announcement created.");
      setEditorOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.announcements.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.announcements.list.invalidate(), utils.announcements.adminList.invalidate()]);
      toast.success("Announcement updated.");
      setEditorOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.announcements.archive.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.announcements.list.invalidate(), utils.announcements.adminList.invalidate()]);
      toast.success("Announcement archived.");
    },
    onError: error => toast.error(error.message),
  });

  const categories = useMemo(() => Array.from(new Set(items.map(item => item.category))).sort(), [items]);
  const filtered = useMemo(
    () => items.filter(item =>
      (category === "all" || item.category === category) &&
      `${item.title} ${item.summary || ""} ${item.body}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [category, items, query],
  );

  function openEditor(item?: (typeof items)[number]) {
    if (!item) {
      setEditingId(null);
      setForm(emptyForm);
    } else {
      setEditingId(item.id);
      setForm({
        title: item.title,
        summary: item.summary || "",
        body: item.body,
        category: item.category,
        status: item.status,
        isPinned: item.isPinned,
        publishAt: item.publishAt ? new Date(item.publishAt).toISOString().slice(0, 16) : "",
        expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
      });
    }
    setEditorOpen(true);
  }

  function submit() {
    const values = {
      ...form,
      summary: form.summary || null,
      publishAt: form.publishAt ? new Date(form.publishAt) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
    };
    if (editingId) update.mutate({ id: editingId, values });
    else create.mutate(values);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Stay in the know"
        title="Announcements"
        description="Read Welfare Pride company updates, important notices, and news from across the organization."
        icon={Megaphone}
        actions={isAdmin ? <Button className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />New announcement</Button> : undefined}
      />

      {(published.error || adminList.error) ? (
        <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Announcements could not be loaded</AlertTitle><AlertDescription>{published.error?.message || adminList.error?.message}</AlertDescription></Alert>
      ) : null}

      <Card className="border-0 shadow-soft">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_240px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search announcements" className="h-11 pl-10" /></label>
          <select value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-md border border-input bg-white px-3 text-sm"><option value="all">All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select>
        </CardContent>
      </Card>

      {filtered.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map(item => (
            <article key={item.id} className="relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className={`absolute inset-y-0 left-0 w-1.5 ${item.isPinned ? "bg-[#D58240]" : "bg-[#5A92C9]"}`} />
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-[#5A92C9]/20 bg-[#5A92C9]/5 text-[#376F9F]">{item.category}</Badge>{isAdmin ? <Badge variant="outline" className="capitalize">{item.status}</Badge> : null}{item.isPinned ? <Badge className="border-0 bg-[#D58240]/10 text-[#9A5727]"><Pin className="mr-1 h-3 w-3" />Pinned</Badge> : null}</div>
              <h2 className="mt-4 text-xl font-bold tracking-[-0.02em]">{item.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.summary || item.body}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{item.publishAt ? new Date(item.publishAt).toLocaleString() : "Not scheduled"}</p>
                <div className="flex items-center gap-1"><Button variant="ghost" size="sm" className="text-[#376F9F]" onClick={() => setDetailId(item.id)}>Read update <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>{isAdmin ? <Button variant="ghost" size="sm" onClick={() => openEditor(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button> : null}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white py-16 text-center"><Megaphone className="mx-auto h-9 w-9 text-[#5A92C9]" /><h2 className="mt-4 font-bold">No announcements in this view</h2><p className="mt-2 text-sm text-muted-foreground">Published Welfare Pride updates will appear here.</p></div>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={open => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail ? <><DialogHeader><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-[#5A92C9]/20 bg-[#5A92C9]/5 text-[#376F9F]">{detail.category}</Badge>{detail.isPinned ? <Badge className="border-0 bg-[#D58240]/10 text-[#9A5727]"><Pin className="mr-1 h-3 w-3" />Pinned</Badge> : null}</div><DialogTitle className="pt-2 text-2xl">{detail.title}</DialogTitle><DialogDescription>{detail.publishAt ? `Published ${new Date(detail.publishAt).toLocaleString()}` : "Not yet scheduled"}</DialogDescription></DialogHeader>{detail.summary ? <p className="rounded-xl bg-[#5A92C9]/5 p-4 font-medium leading-7 text-[#2D5578]">{detail.summary}</p> : null}<div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{detail.body}</div>{isAdmin ? <DialogFooter className="border-t border-border pt-4"><Button variant="outline" onClick={() => { setDetailId(null); openEditor(detail); }}><Pencil className="mr-2 h-4 w-4" />Edit</Button>{detail.status !== "archived" ? <Button variant="destructive" onClick={() => { archive.mutate({ id: detail.id }); setDetailId(null); }}><Archive className="mr-2 h-4 w-4" />Archive</Button> : null}</DialogFooter> : null}</> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit announcement" : "Create announcement"}</DialogTitle><DialogDescription>Draft, schedule, or publish an official Welfare Pride company update.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Status</Label><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as AnnouncementForm["status"] }))} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Summary</Label><Textarea rows={2} value={form.summary} onChange={event => setForm(current => ({ ...current, summary: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Body</Label><Textarea rows={8} value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Publish at</Label><Input type="datetime-local" value={form.publishAt} onChange={event => setForm(current => ({ ...current, publishAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Expires at</Label><Input type="datetime-local" value={form.expiresAt} onChange={event => setForm(current => ({ ...current, expiresAt: event.target.value }))} /></div>
            <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={form.isPinned} onCheckedChange={checked => setForm(current => ({ ...current, isPinned: checked === true }))} /><span className="text-sm font-medium">Pin this announcement</span></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!form.title || !form.body || create.isPending || update.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">Save announcement</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
