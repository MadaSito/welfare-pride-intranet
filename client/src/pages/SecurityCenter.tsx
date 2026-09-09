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
import { Activity, Ban, CheckCircle2, CircleAlert, Clock3, Filter, Loader2, LockKeyhole, Search, ShieldAlert, ShieldCheck, ShieldOff, TimerReset, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PolicyMode = "allow" | "block";
type SecuritySettingsForm = { allowlistEnabled: boolean; rateLimitRequests: number; rateLimitWindowSeconds: number; autoBlockThreshold: number; autoBlockDurationMinutes: number };

const defaultSettings: SecuritySettingsForm = { allowlistEnabled: false, rateLimitRequests: 120, rateLimitWindowSeconds: 60, autoBlockThreshold: 0, autoBlockDurationMinutes: 30 };

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

export default function SecurityCenter() {
  const utils = trpc.useUtils();
  const overview = trpc.securityCenter.overview.useQuery();
  const [settings, setSettings] = useState<SecuritySettingsForm>(defaultSettings);
  const [policyMode, setPolicyMode] = useState<PolicyMode>("block");
  const [policyIpAddress, setPolicyIpAddress] = useState("");
  const [policyLabel, setPolicyLabel] = useState("");
  const [policyExpiry, setPolicyExpiry] = useState("");
  const [revokePolicyId, setRevokePolicyId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ search: "", correlationId: "", severity: "" as "" | "info" | "low" | "medium" | "high" | "critical" });
  const events = trpc.securityCenter.events.useQuery({
    search: filters.search || undefined,
    correlationId: filters.correlationId || undefined,
    severity: filters.severity || undefined,
    limit: 250,
  });

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

  const saveSettings = trpc.securityCenter.saveSettings.useMutation({
    onSuccess: async () => {
      await utils.securityCenter.overview.invalidate();
      await utils.securityCenter.events.invalidate();
      toast.success("Security controls updated and recorded.");
    },
    onError: error => toast.error(error.message),
  });
  const savePolicy = trpc.securityCenter.saveIpPolicy.useMutation({
    onSuccess: async policy => {
      await utils.securityCenter.overview.invalidate();
      await utils.securityCenter.events.invalidate();
      setPolicyIpAddress("");
      setPolicyLabel("");
      setPolicyExpiry("");
      toast.success(`${policy?.mode === "block" ? "Block" : "Allow"} policy saved.`);
    },
    onError: error => toast.error(error.message),
  });
  const revokePolicy = trpc.securityCenter.revokeIpPolicy.useMutation({
    onSuccess: async () => {
      await utils.securityCenter.overview.invalidate();
      await utils.securityCenter.events.invalidate();
      setRevokePolicyId(null);
      toast.success("IP policy revoked and recorded.");
    },
    onError: error => toast.error(error.message),
  });

  const policies = overview.data?.policies || [];
  const activePolicies = useMemo(() => policies.filter(policy => policy.isActive && (!policy.expiresAt || new Date(policy.expiresAt).getTime() > Date.now())), [policies]);
  const policyToRevoke = policies.find(policy => policy.id === revokePolicyId);

  const submitPolicy = () => {
    if (!policyIpAddress.trim() || !policyLabel.trim()) {
      toast.error("Enter an IP address and a policy label.");
      return;
    }
    savePolicy.mutate({
      mode: policyMode,
      ipAddress: policyIpAddress.trim(),
      label: policyLabel.trim(),
      expiresAt: policyExpiry ? new Date(policyExpiry).toISOString() : null,
    });
  };

  return <div className="space-y-7">
    <PageHeader
      eyebrow="Administration"
      title="Security Center"
      description="Monitor correlated security events and manage app-layer IP controls, defensive request throttling, and temporary automated blocks."
      icon={ShieldCheck}
      actions={<Badge variant="outline" className="h-9 border-[#5A92C9]/25 bg-[#5A92C9]/5 px-3 text-[#376F9F]"><LockKeyhole className="mr-2 h-4 w-4" />Administrator only</Badge>}
    />

    <Alert className="border-[#D58240]/30 bg-[#D58240]/5">
      <ShieldAlert className="h-4 w-4 text-[#D58240]" />
      <AlertTitle>Defense-in-depth boundary</AlertTitle>
      <AlertDescription>These policies are enforced by the intranet before application routes and record a correlation ID for blocked, suspicious, and rate-limited requests. They complement, but do not replace, perimeter firewall, WAF, reverse-proxy, patching, identity, and endpoint controls. The health endpoint remains reachable for infrastructure checks.</AlertDescription>
    </Alert>

    {overview.error ? <Alert variant="destructive"><CircleAlert className="h-4 w-4" /><AlertTitle>Security Center data could not be loaded</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><Ban className="h-6 w-6 text-red-600" /><div><p className="text-2xl font-bold">{overview.data?.metrics.activeBlocks ?? 0}</p><p className="text-sm text-muted-foreground">Active IP blocks</p></div></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><ShieldCheck className="h-6 w-6 text-emerald-600" /><div><p className="text-2xl font-bold">{overview.data?.metrics.activeAllows ?? 0}</p><p className="text-sm text-muted-foreground">Active allow policies</p></div></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><TimerReset className="h-6 w-6 text-[#D58240]" /><div><p className="text-2xl font-bold">{overview.data?.metrics.rateLimited24h ?? 0}</p><p className="text-sm text-muted-foreground">Throttled in 24 hours</p></div></CardContent></Card>
      <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><TriangleAlert className="h-6 w-6 text-red-600" /><div><p className="text-2xl font-bold">{overview.data?.metrics.highSeverity24h ?? 0}</p><p className="text-sm text-muted-foreground">High severity in 24 hours</p></div></CardContent></Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-0 shadow-soft">
        <CardHeader className="border-b border-border/70"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Preventive controls</p><CardTitle className="mt-2">Request protection policy</CardTitle></CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-4"><div><p className="font-semibold">Current administrator IP</p><p className="mt-1 text-xs text-muted-foreground">Required in the active allowlist before allowlist-only mode can be enabled.</p></div><code className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-[#376F9F]">{overview.data?.currentIpAddress || "Loading…"}</code></div>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"><span><span className="block text-sm font-semibold">Allowlist-only mode</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Reject requests from every address except active allow policies. The current administrator IP must be allowed first.</span></span><Switch checked={settings.allowlistEnabled} onCheckedChange={allowlistEnabled => setSettings(current => ({ ...current, allowlistEnabled }))} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="rate-limit-requests">Requests per IP</Label><Input id="rate-limit-requests" type="number" min={20} max={10000} value={settings.rateLimitRequests} onChange={event => setSettings(current => ({ ...current, rateLimitRequests: Number(event.target.value) || 20 }))} /><p className="text-xs text-muted-foreground">API requests allowed in each window.</p></div><div className="space-y-2"><Label htmlFor="rate-limit-window">Window seconds</Label><Input id="rate-limit-window" type="number" min={10} max={3600} value={settings.rateLimitWindowSeconds} onChange={event => setSettings(current => ({ ...current, rateLimitWindowSeconds: Number(event.target.value) || 10 }))} /><p className="text-xs text-muted-foreground">Fixed enforcement window per IP address.</p></div><div className="space-y-2"><Label htmlFor="auto-block-threshold">Automatic block threshold</Label><Input id="auto-block-threshold" type="number" min={0} max={100} value={settings.autoBlockThreshold} onChange={event => setSettings(current => ({ ...current, autoBlockThreshold: Number(event.target.value) || 0 }))} /><p className="text-xs text-muted-foreground">Rate-limit breaches before a temporary block; 0 disables it.</p></div><div className="space-y-2"><Label htmlFor="auto-block-duration">Temporary block minutes</Label><Input id="auto-block-duration" type="number" min={5} max={43200} value={settings.autoBlockDurationMinutes} onChange={event => setSettings(current => ({ ...current, autoBlockDurationMinutes: Number(event.target.value) || 5 }))} /><p className="text-xs text-muted-foreground">Expiration for automatic block policies.</p></div></div>
          <Button onClick={() => saveSettings.mutate(settings)} disabled={saveSettings.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">{saveSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Save defensive controls</Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardHeader className="border-b border-border/70"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">IP policy</p><CardTitle className="mt-2">Allow or block an address</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1"><Button type="button" variant={policyMode === "block" ? "default" : "ghost"} className={policyMode === "block" ? "bg-red-600 text-white hover:bg-red-700" : ""} onClick={() => setPolicyMode("block")}><Ban className="mr-2 h-4 w-4" />Block</Button><Button type="button" variant={policyMode === "allow" ? "default" : "ghost"} className={policyMode === "allow" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""} onClick={() => setPolicyMode("allow")}><CheckCircle2 className="mr-2 h-4 w-4" />Allow</Button></div>
          <div className="space-y-2"><Label htmlFor="policy-ip">IPv4 or IPv6 address</Label><Input id="policy-ip" placeholder="203.0.113.10 or 2001:db8::10" value={policyIpAddress} onChange={event => setPolicyIpAddress(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="policy-label">Purpose / case reference</Label><Input id="policy-label" placeholder={policyMode === "block" ? "Suspicious activity review" : "Corporate office egress"} value={policyLabel} onChange={event => setPolicyLabel(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="policy-expiry">Temporary expiry <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="policy-expiry" type="datetime-local" value={policyExpiry} onChange={event => setPolicyExpiry(event.target.value)} /></div>
          <Alert className={policyMode === "block" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}><ShieldOff className={policyMode === "block" ? "h-4 w-4 text-red-600" : "h-4 w-4 text-emerald-600"} /><AlertDescription>{policyMode === "block" ? "Block policies take precedence over allow policies. The portal prevents an administrator from blocking the IP of the current session." : "Allow policies are inactive until allowlist-only mode is enabled, but are retained for a safe staged rollout."}</AlertDescription></Alert>
          <Button onClick={submitPolicy} disabled={savePolicy.isPending} className={policyMode === "block" ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}>{savePolicy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : policyMode === "block" ? <Ban className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{policyMode === "block" ? "Save block policy" : "Save allow policy"}</Button>
        </CardContent>
      </Card>
    </section>

    <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Active response</p><CardTitle className="mt-2">IP allow and block policies</CardTitle></div><Badge variant="outline" className="w-fit border-border bg-muted/40 text-muted-foreground">{activePolicies.length} active</Badge></div></CardHeader><CardContent className="p-5">{activePolicies.length ? <div className="space-y-3">{activePolicies.map(policy => <div key={policy.id} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[130px_1fr_auto] md:items-center"><div><Badge variant="outline" className={policyClass(policy.mode)}>{policy.mode === "block" ? "Blocked" : "Allowed"}</Badge><p className="mt-2 font-mono text-sm font-semibold">{policy.ipAddress}</p></div><div><p className="font-semibold">{policy.label}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{policy.expiresAt ? `Expires ${new Date(policy.expiresAt).toLocaleString()}` : "No expiry"}</p></div><Button variant="outline" size="sm" onClick={() => setRevokePolicyId(policy.id)}>{policy.mode === "block" ? "Unblock" : "Remove allow"}</Button></div>)}</div> : <div className="py-10 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-bold">No active IP policies</p><p className="mt-1 text-sm text-muted-foreground">Create a documented allow or block policy when an operational security event requires one.</p></div>}</CardContent></Card>

    <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Correlation-aware audit log</p><CardTitle className="mt-2">Security event timeline</CardTitle><p className="mt-1 text-sm text-muted-foreground">Use a correlation ID to review related request denial and administrator-response events.</p></div><Badge variant="outline" className="w-fit border-[#5A92C9]/25 bg-[#5A92C9]/5 text-[#376F9F]"><Activity className="mr-1.5 h-3.5 w-3.5" />{events.data?.length ?? 0} events</Badge></div></CardHeader><CardContent className="p-5"><div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_180px_auto]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search security events" className="pl-9" placeholder="IP, path, event, or correlation ID" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} /></div><Input aria-label="Filter by correlation ID" placeholder="Correlation ID" value={filters.correlationId} onChange={event => setFilters(current => ({ ...current, correlationId: event.target.value }))} /><select aria-label="Filter by severity" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.severity} onChange={event => setFilters(current => ({ ...current, severity: event.target.value as typeof filters.severity }))}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option></select><Button variant="outline" onClick={() => setFilters({ search: "", correlationId: "", severity: "" })}><Filter className="mr-2 h-4 w-4" />Clear</Button></div>{events.error ? <Alert className="mt-4" variant="destructive"><CircleAlert className="h-4 w-4" /><AlertTitle>Events could not be loaded</AlertTitle><AlertDescription>{events.error.message}</AlertDescription></Alert> : null}{events.data?.length ? <div className="mt-4 space-y-3">{events.data.map(({ event, actorName, actorEmail }) => <article key={event.id} className="grid gap-3 rounded-xl border border-border p-4 lg:grid-cols-[auto_180px_1fr_auto] lg:items-start"><Badge variant="outline" className={severityClass(event.severity)}>{event.severity}</Badge><div><p className="text-sm font-semibold">{formatEventType(event.eventType)}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{event.ipAddress || "IP unavailable"}</p></div><div><button type="button" className="font-mono text-xs font-semibold text-[#376F9F] hover:underline" onClick={() => setFilters(current => ({ ...current, correlationId: event.correlationId }))}>#{event.correlationId}</button><p className="mt-1 text-sm text-muted-foreground">{event.method || "REQUEST"} {event.requestPath || "—"}</p><p className="mt-1 text-xs text-muted-foreground">{safeDetails(event.detailsJson)}{actorName || actorEmail ? ` · Actor: ${actorName || actorEmail}` : ""}</p></div><time className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</time></article>)}</div> : <div className="py-12 text-center"><Activity className="mx-auto h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-bold">No recorded security events</p><p className="mt-1 text-sm text-muted-foreground">Policy changes, blocked requests, exploit probes, and API throttles will appear here with correlation IDs.</p></div>}</CardContent></Card>

    <AlertDialog open={revokePolicyId !== null} onOpenChange={open => { if (!open) setRevokePolicyId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{policyToRevoke?.mode === "block" ? "Remove this IP block?" : "Remove this allow policy?"}</AlertDialogTitle><AlertDialogDescription>This action takes effect immediately at the application layer and creates a correlated administrator audit event. Perimeter controls, if any, are managed separately.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => revokePolicyId && revokePolicy.mutate({ policyId: revokePolicyId })} className="bg-red-600 text-white hover:bg-red-700">{revokePolicy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm removal</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
