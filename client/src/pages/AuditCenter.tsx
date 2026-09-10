import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

export default function AuditCenter() {
  const [query, setQuery] = useState(""); const [entityType, setEntityType] = useState(""); const [status, setStatus] = useState("");
  const filters = useMemo(() => ({ query: query || undefined, entityType: entityType || undefined, status: status || undefined, limit: 300 }), [entityType, query, status]);
  const audit = trpc.auditCenter.list.useQuery(filters);
  const entityTypes = Array.from(new Set((audit.data || []).map(item => item.entityType))).sort();
  const statuses = Array.from(new Set((audit.data || []).map(item => item.status))).sort();
  return <div className="space-y-7"><PageHeader eyebrow="Accountability" title="System Audit Center" description="Search retained change records for portal resources, configuration, user lifecycle, backups, email delivery, approvals, and security operations." icon={ClipboardList} />
    {audit.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Audit records unavailable</AlertTitle><AlertDescription>{audit.error.message}</AlertDescription></Alert> : null}
    <Card className="border-0 shadow-soft"><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_180px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} className="h-11 pl-10" placeholder="Search messages, entity types, events, or metadata" /></div><select className="h-11 rounded-md border border-input bg-white px-3 text-sm" value={entityType} onChange={event => setEntityType(event.target.value)}><option value="">All entity types</option>{entityTypes.map(item => <option key={item} value={item}>{item}</option>)}</select><select className="h-11 rounded-md border border-input bg-white px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="">All outcomes</option>{statuses.map(item => <option key={item} value={item}>{item}</option>)}</select><Button variant="outline" onClick={() => { setQuery(""); setEntityType(""); setStatus(""); }}>Clear</Button></CardContent></Card>
    <Card className="border-0 shadow-soft"><CardHeader><CardTitle>Change timeline <Badge variant="outline" className="ml-2">{audit.data?.length || 0}</Badge></CardTitle></CardHeader><CardContent>{audit.data?.length ? <div className="space-y-2">{audit.data.map(item => <article key={item.id} className="grid gap-3 rounded-xl border border-border px-4 py-3 md:grid-cols-[180px_1fr_auto]"><div className="flex flex-wrap gap-2"><Badge variant="outline" className="capitalize">{item.entityType.replaceAll("_", " ")}</Badge><Badge variant="outline" className={item.status === "succeeded" || item.status === "published" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "failed" || item.status === "declined" ? "border-red-200 bg-red-50 text-red-700" : "border-[#D58240]/25 bg-[#D58240]/5 text-[#9A5727]"}>{item.status}</Badge></div><div><p className="text-sm font-semibold">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{item.eventType} · Entity #{item.entityId ?? "—"} · Actor #{item.actorUserId ?? "system"}</p></div><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></article>)}</div> : <div className="py-12 text-center text-sm text-muted-foreground">No audit records match the active filters.</div>}</CardContent></Card>
  </div>;
}
