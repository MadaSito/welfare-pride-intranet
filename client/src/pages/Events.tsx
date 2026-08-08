import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Bookmark, BookmarkCheck, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock, ExternalLink, List, MapPin, Pencil, Plus, ShieldAlert, Video, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type EventForm = {
  title: string;
  description: string;
  category: string;
  location: string;
  meetingUrl: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  status: "draft" | "published" | "cancelled" | "archived";
};

const toLocalInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const emptyEvent = (): EventForm => {
  const start = new Date(Date.now() + 86400000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  return { title: "", description: "", category: "Company", location: "", meetingUrl: "", startAt: toLocalInput(start), endAt: toLocalInput(end), isAllDay: false, status: "draft" };
};

export default function Events() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const range = useMemo(() => ({ from: new Date(Date.now() - 365 * 86400000), to: new Date(Date.now() + 730 * 86400000) }), []);
  const published = trpc.events.list.useQuery(range);
  const adminList = trpc.events.adminList.useQuery(undefined, { enabled: isAdmin });
  const pins = trpc.dashboardPins.list.useQuery();
  const items = isAdmin ? (adminList.data || []) : (published.data || []);
  const [view, setView] = useState<"list" | "month">("list");
  const [category, setCategory] = useState("all");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState<EventForm>(() => emptyEvent());

  const categories = useMemo(() => Array.from(new Set(items.map(item => item.category))).sort(), [items]);
  const filtered = useMemo(() => [...items]
    .filter(item => category === "all" || item.category === category)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [category, items]);
  const detail = items.find(item => item.id === detailId) || null;
  const pinnedEventIds = useMemo(() => new Set(pins.data?.pinnedEventIds || []), [pins.data?.pinnedEventIds]);
  const deepLinkedEventId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const value = Number(new URLSearchParams(window.location.search).get("event"));
    return Number.isInteger(value) && value > 0 ? value : null;
  }, []);
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);

  const create = trpc.events.create.useMutation({ onSuccess: async () => { await Promise.all([utils.events.list.invalidate(), utils.events.adminList.invalidate()]); toast.success("Event created."); setEditorOpen(false); }, onError: error => toast.error(error.message) });
  const update = trpc.events.update.useMutation({ onSuccess: async () => { await Promise.all([utils.events.list.invalidate(), utils.events.adminList.invalidate()]); toast.success("Event updated."); setEditorOpen(false); }, onError: error => toast.error(error.message) });
  const cancel = trpc.events.cancel.useMutation({ onSuccess: async () => { await Promise.all([utils.events.list.invalidate(), utils.events.adminList.invalidate()]); toast.success("Event cancelled."); setDetailId(null); }, onError: error => toast.error(error.message) });
  const pinEvent = trpc.dashboardPins.pinEvent.useMutation({ onSuccess: async () => { await utils.dashboardPins.list.invalidate(); toast.success("Event pinned to your dashboard."); }, onError: error => toast.error(error.message) });
  const removePin = trpc.dashboardPins.remove.useMutation({ onSuccess: async () => { await utils.dashboardPins.list.invalidate(); toast.success("Event removed from your dashboard."); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    if (deepLinkedEventId && items.some(item => item.id === deepLinkedEventId)) setDetailId(deepLinkedEventId);
  }, [deepLinkedEventId, items]);

  function toggleEventPin(eventId: number) {
    if (pinnedEventIds.has(eventId)) removePin.mutate({ pinType: "event", targetKey: String(eventId) });
    else pinEvent.mutate({ eventId });
  }

  function openEditor(item?: (typeof items)[number]) {
    if (!item) {
      setEditingId(null);
      setForm(emptyEvent());
    } else {
      setEditingId(item.id);
      setForm({
        title: item.title,
        description: item.description || "",
        category: item.category,
        location: item.location || "",
        meetingUrl: item.meetingUrl || "",
        startAt: toLocalInput(new Date(item.startAt)),
        endAt: toLocalInput(new Date(item.endAt)),
        isAllDay: item.isAllDay,
        status: item.status,
      });
    }
    setEditorOpen(true);
  }

  function submit() {
    const values = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      location: form.location || null,
      meetingUrl: form.meetingUrl || null,
      startAt: new Date(form.startAt),
      endAt: new Date(form.endAt),
      isAllDay: form.isAllDay,
      status: form.status,
    };
    if (editingId) update.mutate({ id: editingId, values });
    else create.mutate(values);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="See what’s happening"
        title="Events"
        description="Browse company meetings, celebrations, learning sessions, and other Welfare Pride events."
        icon={CalendarDays}
        actions={<div className="flex flex-wrap gap-2"><div className="flex rounded-lg border border-border bg-white p-1"><Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}><List className="mr-1.5 h-4 w-4" />List</Button><Button variant={view === "month" ? "secondary" : "ghost"} size="sm" onClick={() => setView("month")}><CalendarRange className="mr-1.5 h-4 w-4" />Calendar</Button></div>{isAdmin ? <Button className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />New event</Button> : null}</div>}
      />

      {(published.error || adminList.error) ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Events could not be loaded</AlertTitle><AlertDescription>{published.error?.message || adminList.error?.message}</AlertDescription></Alert> : null}

      <Card className="border-0 shadow-soft"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D58240]">Filter events</p><p className="mt-1 text-sm text-muted-foreground">Choose a category to focus this view.</p></div><select value={category} onChange={event => setCategory(event.target.value)} className="h-10 min-w-56 rounded-md border border-input bg-white px-3 text-sm"><option value="all">All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></CardContent></Card>

      {filtered.length ? view === "list" ? (
        <div className="space-y-4">
          {filtered.map(item => (
            <article key={item.id} className="grid gap-5 rounded-2xl border border-border bg-white p-5 shadow-sm md:grid-cols-[90px_1fr_auto]">
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#376F9F]"><span className="text-xs font-bold uppercase">{new Date(item.startAt).toLocaleString(undefined, { month: "short" })}</span><span className="text-2xl font-bold">{new Date(item.startAt).getDate()}</span></div>
              <div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-[#D58240]/25 bg-[#D58240]/5 text-[#9A5727]">{item.category}</Badge>{isAdmin ? <Badge variant="outline" className="capitalize">{item.status}</Badge> : null}</div><h2 className="mt-3 text-lg font-bold">{item.title}</h2>{item.description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(item.startAt).toLocaleString()}</span>{item.location ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span> : null}</div></div>
              <div className="flex items-start gap-1">{(pinnedEventIds.has(item.id) || (item.status === "published" && new Date(item.endAt).getTime() >= Date.now())) ? <Button variant="ghost" size="icon" className="h-8 w-8 text-[#D58240]" aria-label={pinnedEventIds.has(item.id) ? `Unpin ${item.title}` : `Pin ${item.title}`} title={pinnedEventIds.has(item.id) ? "Remove from dashboard" : "Pin to dashboard"} onClick={() => toggleEventPin(item.id)} disabled={pinEvent.isPending || removePin.isPending}>{pinnedEventIds.has(item.id) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}</Button> : null}<Button variant="ghost" size="sm" className="text-[#376F9F]" onClick={() => setDetailId(item.id)}>View details</Button>{isAdmin ? <Button variant="ghost" size="sm" onClick={() => openEditor(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button> : null}</div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden border-0 shadow-soft">
          <CardHeader className="flex-row items-center justify-between border-b border-border/70"><CardTitle>{format(month, "MMMM yyyy")}</CardTitle><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setMonth(current => subMonths(current, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button><Button variant="outline" size="icon" onClick={() => setMonth(current => addMonths(current, 1))}><ChevronRight className="h-4 w-4" /></Button></div></CardHeader>
          <CardContent className="p-0"><div className="grid grid-cols-7 border-b border-border/70 bg-muted/40 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <div key={day} className="px-2 py-3">{day}</div>)}</div><div className="grid grid-cols-7">{monthDays.map(day => { const dayItems = filtered.filter(item => format(new Date(item.startAt), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")); return <div key={day.toISOString()} className={`min-h-28 border-b border-r border-border/60 p-2 ${isSameMonth(day, month) ? "bg-white" : "bg-muted/25 text-muted-foreground/55"}`}><span className="text-xs font-semibold">{day.getDate()}</span><div className="mt-2 space-y-1">{dayItems.slice(0,3).map(item => <button key={item.id} onClick={() => setDetailId(item.id)} className="block w-full truncate rounded bg-[#5A92C9]/10 px-1.5 py-1 text-left text-[10px] font-medium text-[#376F9F] hover:bg-[#5A92C9]/20">{item.title}</button>)}{dayItems.length > 3 ? <p className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</p> : null}</div></div>; })}</div></CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white py-16 text-center"><CalendarDays className="mx-auto h-9 w-9 text-[#5A92C9]" /><h2 className="mt-4 font-bold">No events in this view</h2><p className="mt-2 text-sm text-muted-foreground">Choose another category or publish a Welfare Pride event.</p></div>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={open => !open && setDetailId(null)}>
        <DialogContent className="max-w-xl">
          {detail ? <><DialogHeader><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-[#D58240]/25 bg-[#D58240]/5 text-[#9A5727]">{detail.category}</Badge>{isAdmin ? <Badge variant="outline" className="capitalize">{detail.status}</Badge> : null}</div><DialogTitle className="pt-2 text-2xl">{detail.title}</DialogTitle><DialogDescription>Welfare Pride company event details</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-xl bg-[#5A92C9]/5 p-4 text-sm"><p className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 text-[#5A92C9]" /><span>{new Date(detail.startAt).toLocaleString()} – {new Date(detail.endAt).toLocaleString()}</span></p>{detail.location ? <p className="mt-3 flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[#5A92C9]" />{detail.location}</p> : null}</div>{detail.description ? <p className="whitespace-pre-wrap text-sm leading-7">{detail.description}</p> : null}{detail.meetingUrl ? <a href={detail.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-[#376F9F]"><Video className="mr-2 h-4 w-4" />Join online <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a> : null}</div><DialogFooter className="border-t border-border pt-4"><Button variant="outline" onClick={() => toggleEventPin(detail.id)} disabled={pinEvent.isPending || removePin.isPending || (!pinnedEventIds.has(detail.id) && (detail.status !== "published" || new Date(detail.endAt).getTime() < Date.now()))}>{pinnedEventIds.has(detail.id) ? <BookmarkCheck className="mr-2 h-4 w-4 text-[#D58240]" /> : <Bookmark className="mr-2 h-4 w-4 text-[#D58240]" />}{pinnedEventIds.has(detail.id) ? "Remove from dashboard" : "Pin to dashboard"}</Button>{isAdmin ? <><Button variant="outline" onClick={() => { setDetailId(null); openEditor(detail); }}><Pencil className="mr-2 h-4 w-4" />Edit</Button>{detail.status !== "cancelled" ? <Button variant="destructive" onClick={() => cancel.mutate({ id: detail.id })}><XCircle className="mr-2 h-4 w-4" />Cancel event</Button> : null}</> : null}</DialogFooter></> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit event" : "Create event"}</DialogTitle><DialogDescription>Publish a Welfare Pride company event with in-person or online details.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Status</Label><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as EventForm["status"] }))} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Description</Label><Textarea rows={5} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Starts</Label><Input type="datetime-local" value={form.startAt} onChange={event => setForm(current => ({ ...current, startAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Ends</Label><Input type="datetime-local" value={form.endAt} onChange={event => setForm(current => ({ ...current, endAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Online meeting URL</Label><Input type="url" value={form.meetingUrl} onChange={event => setForm(current => ({ ...current, meetingUrl: event.target.value }))} /></div>
            <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={form.isAllDay} onCheckedChange={checked => setForm(current => ({ ...current, isAllDay: checked === true }))} /><span className="text-sm font-medium">All-day event</span></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!form.title || !form.startAt || !form.endAt || create.isPending || update.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">Save event</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
