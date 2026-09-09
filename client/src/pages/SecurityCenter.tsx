import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { Activity, Ban, BarChart3, CalendarRange, CheckCircle2, CircleAlert, Clock3, Download, FileSearch, Filter, Loader2, LockKeyhole, Search, ShieldAlert, ShieldCheck, ShieldOff, TimerReset, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type PolicyMode = "allow" | "block";
type SecuritySettingsForm = { allowlistEnabled: boolean; rateLimitRequests: number; rateLimitWindowSeconds: number; autoBlockThreshold: number; autoBlockDurationMinutes: number };
type SeverityFilter = "" | "info" | "low" | "medium" | "high" | "critical";
type EventFilters = { search: string; correlationId: string; ipAddress: string; severity: SeverityFilter; eventType: string; fromDate: string; toDate: string; limit: 50 | 100 | 250 | 500 };

const defaultSettings: SecuritySettingsForm = { allowlistEnabled: false, rateLimitRequests: 120, rateLimitWindowSeconds: 60, autoBlockThreshold: 0, autoBlockDurationMinutes: 30 };
const defaultFilters: EventFilters = { search: "", correlationId: "", ipAddress: "", severity: "", eventType: "", fromDate: "", toDate: "", limit: 250 };

function severityClass(severity: string) {
  if (severity === "critical") return "border-red-300 bg-red-100 text-red-800";
  if (severity === "high") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "medium") return "border-[#D58240]/35 bg-[#D58240]/10 text-[#8A4D25]";
  if (severity === "low") return "border-[#5A92C9]/25 bg-[#5A92C9]/10 text-[#376F9F]";
  return "border-border bg-muted/50 text-muted-foreground";
}

function policyClass(mode: PolicyMode) {
  return mode === "block" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatEventType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function safeDetails(value: string | null) {
  if (!value) return "No additional metadata.";
  try {
    const details = JSON.parse(value) as Record<string, unknown>;
    return Object.entries(details).filter(([, item]) => item !== null && item !== undefined).map(([key, item]) => `${key}: ${String(item)}`).join(" · ") || "No additional metadata.";
  } catch {
    return "Recorded security event metadata.";
  }
}

function utcRangeStart(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function utcRangeEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999Z`) : undefined;
}

function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SecurityCenter() {
  const utils = trpc.useUtils();
  const overview = trpc.securityCenter.overview.useQuery();
  const analytics = trpc.securityCenter.analytics.useQuery(undefined, { refetchInterval: 60_000 });
  const threatEventTypes = trpc.securityCenter.threatEventTypes.useQuery();
  const [settings, setSettings] = useState<SecuritySettingsForm>(defaultSettings);
  const [policyMode, setPolicyMode] = useState<PolicyMode>("block");
  const [policyIpAddress, setPolicyIpAddress] = useState("");
  const [policyLabel, setPolicyLabel] = useState("");
  const [policyExpiry, setPolicyExpiry] = useState("");
  const [revokePolicyId, setRevokePolicyId] = useState<number | null>(null);
  const [filters, setFilters] = useState<EventFilters>(defaultFilters);

  const timelineInput = useMemo(() => ({
    search: filters.search.trim() || undefined,
    correlationId: filters.correlationId.trim() || undefined,
    ipAddress: filters.ipAddress.trim() || undefined,
    severity: filters.severity || undefined,
    eventType: filters.eventType || undefined,
    fromDate: utcRangeStart(filters.fromDate),
    toDate: utcRangeEnd(filters.toDate),
    limit: filters.limit,
  }), [filters]);
  const events = trpc.securityCenter.events.useQuery(timelineInput);

  useEffect(() => {
    if (!overview.data?.settings) return;
    const next = overview.data.settings;
    setSettings({
      allowlistEnabled: next.allowlistEnabled,
      rateLimitRequests: next.rateLimitRequests,
      rateLimitWindowSeconds: next.rateLimitWindowSeconds,
      autoBlockThreshold: next.autoBlockThreshold,
      autoBlockDurationMinutes: next.autoBlockDurationMinutes,
    });
  }, [overview.data?.settings]);

  const invalidateSecurityData = async () => {
    await Promise.all([
      utils.securityCenter.overview.invalidate(),
      utils.securityCenter.analytics.invalidate(),
      utils.securityCenter.events.invalidate(),
    ]);
  };
  const saveSettings = trpc.securityCenter.saveSettings.useMutation({
    onSuccess: async () => { await invalidateSecurityData(); toast.success("Security controls updated and recorded."); },
    onError: error => toast.error(error.message),
  });
  const savePolicy = trpc.securityCenter.saveIpPolicy.useMutation({
    onSuccess: async policy => {
      await invalidateSecurityData();
      setPolicyIpAddress("");
      setPolicyLabel("");
      setPolicyExpiry("");
      toast.success(`${policy?.mode === "block" ? "Block" : "Allow"} policy saved.`);
    },
    onError: error => toast.error(error.message),
  });
  const revokePolicy = trpc.securityCenter.revokeIpPolicy.useMutation({
    onSuccess: async () => { await invalidateSecurityData(); setRevokePolicyId(null); toast.success("IP policy revoked and recorded."); },
    onError: error => toast.error(error.message),
  });
  const exportEvents = trpc.securityCenter.exportEvents.useMutation({
    onSuccess: async result => {
      downloadCsv(result.fileName, result.csv);
      await invalidateSecurityData();
      toast.success(`${result.rowCount} audit event${result.rowCount === 1 ? "" : "s"} exported as CSV.`);
    },
    onError: error => toast.error(error.message),
  });

  const policies = overview.data?.policies || [];
  const activePolicies = useMemo(() => policies.filter(policy => policy.isActive && (!policy.expiresAt || new Date(policy.expiresAt).getTime() > Date.now())), [policies]);
  const policyToRevoke = policies.find(policy => policy.id === revokePolicyId);
  const topIpData = analytics.data?.topBlockedIps || [];
  const topThreatData = analytics.data?.topThreatTypes.map(item => ({ ...item, label: formatEventType(item.eventType) })) || [];

  const submitPolicy = () => {
    if (!policyIpAddress.trim() || !policyLabel.trim()) { toast.error("Enter an IP address and a policy label."); return; }
    savePolicy.mutate({ mode: policyMode, ipAddress: policyIpAddress.trim(), label: policyLabel.trim(), expiresAt: policyExpiry ? new Date(policyExpiry).toISOString() : null });
  };

  const exportCurrentResults = () => exportEvents.mutate({ ...timelineInput, limit: 5_000 });

  return <div className="space-y-7">
    <PageHeader eyebrow="Administration" title="Security Center" description="Monitor correlated security events, investigate seven-day threat activity, export filtered evidence, and manage app-layer defensive controls." icon={ShieldCheck} actions={<Badge variant="outline" className="h-9 border-[#5A92C9]/25 bg-[#5A92C9]/5 px-3 text-[#376F9F]"><LockKeyhole className="mr-2 h-4 w-4" />Administrator only</Badge>} />

    <Alert className="border-[#D58240]/30 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>Defense-in-depth boundary</AlertTitle><AlertDescription>These policies are enforced by the intranet before application routes. The dashboard and CSV report application-layer security signals; preserve correlation IDs alongside reverse-proxy, firewall, identity, and endpoint investigation records.</AlertDescription></Alert>
    {overview.error ? <Alert variant="destructive"><CircleAlert className="h-4 w-4" /><AlertTitle>Security Center data could not be loaded</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><Ban className="h-6 w-6 text-red-600" /><div><p className="text-2xl font-bold">{overview.data?.metrics.activeBlocks ?? 0}</p><p className="text-sm text-muted-foreground">Active IP blocks</p></div></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="h-6 w-6 text-emerald-600" /><div><p className="text-2xl font-bold">{overview.data?.metrics.activeAllows ?? 0}</p><p className="text-sm text-muted-foreground">Active allow policies</p></div></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><TimerReset className="h-6 w-6 text-[#D58240]" /><div><p className="text-2xl font-bold">{overview.data?.metrics.rateLimited24h ?? 0}</p><p className="text-sm text-muted-foreground">Throttled in 24 hours</p></div></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><TriangleAlert className="h-6 w-6 text-red-600" /><div><p className="text-2xl font-bold">{analytics.data?.totalThreatEvents ?? 0}</p><p className="text-sm text-muted-foreground">Threat events in 7 days</p></div></CardContent></Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Seven-day analytics</p><CardTitle className="mt-2">Top blocked IP addresses</CardTitle></div><BarChart3 className="h-5 w-5 text-[#5A92C9]" /></div></CardHeader><CardContent className="p-5">{topIpData.length ? <div className="h-72" aria-label="Bar chart showing top blocked IP addresses in the last seven days"><ResponsiveContainer width="100%" height="100%"><BarChart data={topIpData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}><CartesianGrid horizontal={false} strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="ipAddress" width={110} tick={{ fontSize: 12 }} /><Tooltip cursor={{ fill: "#5A92C914" }} formatter={(value: number) => [value, "Block events"]} /><Bar dataKey="count" radius={[0, 6, 6, 0]}>{topIpData.map(item => <Cell key={item.ipAddress} fill="#5A92C9" />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="flex h-72 flex-col items-center justify-center text-center"><Ban className="h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-semibold">No blocked IP activity in this window</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Blocked-request and automatic-block events will appear here as they are recorded.</p></div>}</CardContent></Card>
      <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Seven-day analytics</p><CardTitle className="mt-2">Most frequent security threats</CardTitle></div><ShieldAlert className="h-5 w-5 text-[#D58240]" /></div></CardHeader><CardContent className="p-5">{topThreatData.length ? <div className="h-72" aria-label="Bar chart showing most frequent security threat types in the last seven days"><ResponsiveContainer width="100%" height="100%"><BarChart data={topThreatData} margin={{ top: 8, right: 12, left: -12, bottom: 36 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" interval={0} angle={-22} textAnchor="end" height={62} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip cursor={{ fill: "#D5824014" }} formatter={(value: number) => [value, "Events"]} /><Bar dataKey="count" fill="#D58240" radius={[6, 6, 0, 0]}>{topThreatData.map(item => <Cell key={item.eventType} fill="#D58240" />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="flex h-72 flex-col items-center justify-center text-center"><ShieldCheck className="h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-semibold">No threat events in this window</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">The chart excludes routine policy administration and updates when defensive events are recorded.</p></div>}</CardContent></Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Preventive controls</p><CardTitle className="mt-2">Request protection policy</CardTitle></CardHeader><CardContent className="space-y-5 p-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-4"><div><p className="font-semibold">Current administrator IP</p><p className="mt-1 text-xs text-muted-foreground">Required in the active allowlist before allowlist-only mode can be enabled.</p></div><code className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-[#376F9F]">{overview.data?.currentIpAddress || "Loading…"}</code></div><label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"><span><span className="block text-sm font-semibold">Allowlist-only mode</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Reject requests from every address except active allow policies. The current administrator IP must be allowed first.</span></span><Switch checked={settings.allowlistEnabled} onCheckedChange={allowlistEnabled => setSettings(current => ({ ...current, allowlistEnabled }))} /></label><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="rate-limit-requests">Requests per IP</Label><Input id="rate-limit-requests" type="number" min={20} max={10000} value={settings.rateLimitRequests} onChange={event => setSettings(current => ({ ...current, rateLimitRequests: Number(event.target.value) || 20 }))} /><p className="text-xs text-muted-foreground">API requests allowed in each window.</p></div><div className="space-y-2"><Label htmlFor="rate-limit-window">Window seconds</Label><Input id="rate-limit-window" type="number" min={10} max={3600} value={settings.rateLimitWindowSeconds} onChange={event => setSettings(current => ({ ...current, rateLimitWindowSeconds: Number(event.target.value) || 10 }))} /><p className="text-xs text-muted-foreground">Fixed enforcement window per IP address.</p></div><div className="space-y-2"><Label htmlFor="auto-block-threshold">Automatic block threshold</Label><Input id="auto-block-threshold" type="number" min={0} max={100} value={settings.autoBlockThreshold} onChange={event => setSettings(current => ({ ...current, autoBlockThreshold: Number(event.target.value) || 0 }))} /><p className="text-xs text-muted-foreground">Rate-limit breaches before a temporary block; 0 disables it.</p></div><div className="space-y-2"><Label htmlFor="auto-block-duration">Temporary block minutes</Label><Input id="auto-block-duration" type="number" min={5} max={43200} value={settings.autoBlockDurationMinutes} onChange={event => setSettings(current => ({ ...current, autoBlockDurationMinutes: Number(event.target.value) || 5 }))} /><p className="text-xs text-muted-foreground">Expiration for automatic block policies.</p></div></div><Button onClick={() => saveSettings.mutate(settings)} disabled={saveSettings.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">{saveSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Save defensive controls</Button></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">IP policy</p><CardTitle className="mt-2">Allow or block an address</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1"><Button type="button" variant={policyMode === "block" ? "default" : "ghost"} className={policyMode === "block" ? "bg-red-600 text-white hover:bg-red-700" : ""} onClick={() => setPolicyMode("block")}><Ban className="mr-2 h-4 w-4" />Block</Button><Button type="button" variant={policyMode === "allow" ? "default" : "ghost"} className={policyMode === "allow" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""} onClick={() => setPolicyMode("allow")}><CheckCircle2 className="mr-2 h-4 w-4" />Allow</Button></div><div className="space-y-2"><Label htmlFor="policy-ip">IPv4 or IPv6 address</Label><Input id="policy-ip" placeholder="203.0.113.10 or 2001:db8::10" value={policyIpAddress} onChange={event => setPolicyIpAddress(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="policy-label">Purpose / case reference</Label><Input id="policy-label" placeholder={policyMode === "block" ? "Suspicious activity review" : "Corporate office egress"} value={policyLabel} onChange={event => setPolicyLabel(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="policy-expiry">Temporary expiry <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="policy-expiry" type="datetime-local" value={policyExpiry} onChange={event => setPolicyExpiry(event.target.value)} /></div><Alert className={policyMode === "block" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}><ShieldOff className={policyMode === "block" ? "h-4 w-4 text-red-600" : "h-4 w-4 text-emerald-600"} /><AlertDescription>{policyMode === "block" ? "Block policies take precedence over allow policies. The portal prevents an administrator from blocking the IP of the current session." : "Allow policies are inactive until allowlist-only mode is enabled, but are retained for a safe staged rollout."}</AlertDescription></Alert><Button onClick={submitPolicy} disabled={savePolicy.isPending} className={policyMode === "block" ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}>{savePolicy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : policyMode === "block" ? <Ban className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{policyMode === "block" ? "Save block policy" : "Save allow policy"}</Button></CardContent></Card>
    </section>

    <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Active response</p><CardTitle className="mt-2">IP allow and block policies</CardTitle></div><Badge variant="outline" className="w-fit border-border bg-muted/40 text-muted-foreground">{activePolicies.length} active</Badge></div></CardHeader><CardContent className="p-5">{activePolicies.length ? <div className="space-y-3">{activePolicies.map(policy => <div key={policy.id} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[130px_1fr_auto] md:items-center"><div><Badge variant="outline" className={policyClass(policy.mode)}>{policy.mode === "block" ? "Blocked" : "Allowed"}</Badge><p className="mt-2 font-mono text-sm font-semibold">{policy.ipAddress}</p></div><div><p className="font-semibold">{policy.label}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{policy.expiresAt ? `Expires ${new Date(policy.expiresAt).toLocaleString()}` : "No expiry"}</p></div><Button variant="outline" size="sm" onClick={() => setRevokePolicyId(policy.id)}>{policy.mode === "block" ? "Unblock" : "Remove allow"}</Button></div>)}</div> : <div className="py-10 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-bold">No active IP policies</p><p className="mt-1 text-sm text-muted-foreground">Create a documented allow or block policy when an operational security event requires one.</p></div>}</CardContent></Card>

    <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Correlation-aware audit log</p><CardTitle className="mt-2">Security event timeline</CardTitle><p className="mt-1 text-sm text-muted-foreground">Apply exact investigation filters, then download the resulting administrator-only event set for offline analysis.</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="w-fit border-[#5A92C9]/25 bg-[#5A92C9]/5 text-[#376F9F]"><Activity className="mr-1.5 h-3.5 w-3.5" />{events.data?.length ?? 0} shown</Badge><Button size="sm" variant="outline" onClick={exportCurrentResults} disabled={exportEvents.isPending}><Download className="mr-2 h-4 w-4" />{exportEvents.isPending ? "Preparing…" : "Export CSV"}</Button></div></div></CardHeader><CardContent className="p-5"><div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search security events" className="pl-9" placeholder="Path, event, IP, or ID" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} /></div><Input aria-label="Filter by exact correlation ID" placeholder="Exact correlation ID" value={filters.correlationId} onChange={event => setFilters(current => ({ ...current, correlationId: event.target.value }))} /><Input aria-label="Filter by exact IP address" placeholder="Exact IP address" value={filters.ipAddress} onChange={event => setFilters(current => ({ ...current, ipAddress: event.target.value }))} /><select aria-label="Filter by severity" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.severity} onChange={event => setFilters(current => ({ ...current, severity: event.target.value as SeverityFilter }))}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option></select><select aria-label="Filter by threat type" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.eventType} onChange={event => setFilters(current => ({ ...current, eventType: event.target.value }))}><option value="">All event types</option>{(threatEventTypes.data || []).map(type => <option key={type} value={type}>{formatEventType(type)}</option>)}</select><label className="relative"><span className="sr-only">From UTC date</span><CalendarRange className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="From UTC date" type="date" value={filters.fromDate} onChange={event => setFilters(current => ({ ...current, fromDate: event.target.value }))} /></label><label className="relative"><span className="sr-only">To UTC date</span><CalendarRange className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="To UTC date" type="date" value={filters.toDate} onChange={event => setFilters(current => ({ ...current, toDate: event.target.value }))} /></label><select aria-label="Result limit" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.limit} onChange={event => setFilters(current => ({ ...current, limit: Number(event.target.value) as EventFilters["limit"] }))}><option value={50}>50 results</option><option value={100}>100 results</option><option value={250}>250 results</option><option value={500}>500 results</option></select></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><FileSearch className="h-3.5 w-3.5 text-[#5A92C9]" />Exact correlation and IP filters combine with severity, threat type, search, and a maximum 90-day date range.</p><Button variant="outline" size="sm" onClick={() => setFilters(defaultFilters)}><Filter className="mr-2 h-4 w-4" />Clear filters</Button></div>{events.error ? <Alert className="mt-4" variant="destructive"><CircleAlert className="h-4 w-4" /><AlertTitle>Events could not be loaded</AlertTitle><AlertDescription>{events.error.message}</AlertDescription></Alert> : null}{events.data?.length ? <div className="mt-4 space-y-3">{events.data.map(({ event, actorName, actorEmail }) => <article key={event.id} className="grid gap-3 rounded-xl border border-border p-4 lg:grid-cols-[auto_180px_1fr_auto] lg:items-start"><Badge variant="outline" className={severityClass(event.severity)}>{event.severity}</Badge><div><p className="text-sm font-semibold">{formatEventType(event.eventType)}</p><button type="button" className="mt-1 font-mono text-xs text-[#376F9F] hover:underline" onClick={() => setFilters(current => ({ ...current, ipAddress: event.ipAddress || "" }))}>{event.ipAddress || "IP unavailable"}</button></div><div><button type="button" className="font-mono text-xs font-semibold text-[#376F9F] hover:underline" onClick={() => setFilters(current => ({ ...current, correlationId: event.correlationId }))}>#{event.correlationId}</button><p className="mt-1 text-sm text-muted-foreground">{event.method || "REQUEST"} {event.requestPath || "—"}</p><p className="mt-1 text-xs text-muted-foreground">{safeDetails(event.detailsJson)}{actorName || actorEmail ? ` · Actor: ${actorName || actorEmail}` : ""}</p></div><time className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</time></article>)}</div> : <div className="py-12 text-center"><Activity className="mx-auto h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-bold">No matching security events</p><p className="mt-1 text-sm text-muted-foreground">Adjust the investigation filters or wait for a policy change, denied request, exploit probe, or API throttle event.</p></div>}</CardContent></Card>

    <AlertDialog open={revokePolicyId !== null} onOpenChange={open => { if (!open) setRevokePolicyId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{policyToRevoke?.mode === "block" ? "Remove this IP block?" : "Remove this allow policy?"}</AlertDialogTitle><AlertDialogDescription>This action takes effect immediately at the application layer and creates a correlated administrator audit event. Perimeter controls, if any, are managed separately.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => revokePolicyId && revokePolicy.mutate({ policyId: revokePolicyId })} className="bg-red-600 text-white hover:bg-red-700">{revokePolicy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm removal</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
