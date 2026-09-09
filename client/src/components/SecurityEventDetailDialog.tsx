import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Activity, ChevronRight, Copy, FileJson, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type SecurityEventDetailDialogProps = {
  eventId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEvent: (eventId: number) => void;
  onInvestigateCorrelation: (correlationId: string) => void;
};

function eventLabel(eventType: string) {
  return eventType.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function severityClass(severity: string) {
  if (severity === "critical") return "border-red-300 bg-red-100 text-red-800";
  if (severity === "high") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "medium") return "border-[#D58240]/35 bg-[#D58240]/10 text-[#8A4D25]";
  if (severity === "low") return "border-[#5A92C9]/25 bg-[#5A92C9]/10 text-[#376F9F]";
  return "border-border bg-muted/50 text-muted-foreground";
}

function safePayload(value: string | null) {
  if (!value) return "{}";
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}

export function SecurityEventDetailDialog({ eventId, open, onOpenChange, onSelectEvent, onInvestigateCorrelation }: SecurityEventDetailDialogProps) {
  const detail = trpc.securityCenter.eventDetail.useQuery({ eventId: eventId || 1 }, { enabled: open && Boolean(eventId) });
  const selected = detail.data?.selected;

  const copyCorrelation = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.event.correlationId); toast.success("Correlation ID copied."); } catch { toast.error("Copy is not available in this browser."); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
      <DialogHeader className="border-b border-border px-6 py-5 text-left"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#5A92C9]/10 p-2.5 text-[#376F9F]"><FileJson className="h-5 w-5" /></span><div><DialogTitle>Security event investigation</DialogTitle><DialogDescription className="mt-1">Review captured event metadata and all retained events that share this correlation ID. Request bodies and query values are not stored.</DialogDescription></div></div></DialogHeader>
      {detail.isLoading ? <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading correlated event data…</div> : null}
      {detail.error ? <div className="m-6 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{detail.error.message}</div> : null}
      {selected ? <ScrollArea className="max-h-[calc(92vh-12rem)]"><div className="space-y-6 px-6 py-5"><section className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline" className={severityClass(selected.event.severity)}>{selected.event.severity}</Badge><span className="font-semibold">{eventLabel(selected.event.eventType)}</span></div><time className="text-xs text-muted-foreground">{new Date(selected.event.createdAt).toLocaleString()}</time></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event ID</dt><dd className="mt-1 font-mono">{selected.event.id}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source IP</dt><dd className="mt-1 font-mono">{selected.event.ipAddress || "Unavailable"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actor</dt><dd className="mt-1 truncate">{selected.actorName || selected.actorEmail || "System"}</dd></div><div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correlation ID</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><code className="max-w-full break-all rounded bg-white px-2 py-1 text-xs text-[#376F9F]">{selected.event.correlationId}</code><Button variant="ghost" size="sm" onClick={copyCorrelation}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</Button></dd></div><div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request target</dt><dd className="mt-1 font-mono text-xs">{selected.event.method || "REQUEST"} {selected.event.requestPath || "—"}</dd></div></dl></section><section><div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-[#5A92C9]" /><h3 className="font-semibold">Captured event payload</h3></div><pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-5 text-slate-100">{safePayload(selected.event.detailsJson)}</pre></section><section><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#D58240]" /><h3 className="font-semibold">Related correlation events</h3><Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">{detail.data?.related.length || 0}</Badge></div><div className="mt-3 space-y-2">{detail.data?.related.map(({ event, actorName, actorEmail }) => <button key={event.id} type="button" onClick={() => onSelectEvent(event.id)} className={`grid w-full gap-2 rounded-xl border p-3 text-left transition-colors hover:bg-[#5A92C9]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[auto_1fr_auto] sm:items-center ${event.id === selected.event.id ? "border-[#5A92C9]/35 bg-[#5A92C9]/5" : "border-border"}`}><Badge variant="outline" className={severityClass(event.severity)}>{event.severity}</Badge><span className="min-w-0"><span className="block truncate text-sm font-semibold">{eventLabel(event.eventType)}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{event.method || "REQUEST"} {event.requestPath || "—"}{actorName || actorEmail ? ` · ${actorName || actorEmail}` : ""}</span></span><span className="flex items-center gap-2 text-xs text-muted-foreground"><time>{new Date(event.createdAt).toLocaleString()}</time><ChevronRight className="h-4 w-4" /></span></button>)}</div></section></div></ScrollArea> : null}
      <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>{selected ? <Button onClick={() => onInvestigateCorrelation(selected.event.correlationId)} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><Search className="mr-2 h-4 w-4" />Filter timeline by correlation</Button> : null}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
