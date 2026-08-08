import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArchiveRestore, CheckCircle2, FileClock, Loader2, RotateCcw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function auditStatusClass(status: string) {
  return status === "succeeded"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "running"
      ? "border-[#5A92C9]/25 bg-[#5A92C9]/5 text-[#376F9F]"
      : "border-red-200 bg-red-50 text-red-700";
}

export default function RestoreHistory() {
  const overview = trpc.backups.overview.useQuery();
  const utils = trpc.useUtils();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const restore = trpc.backups.restore.useMutation({
    onSuccess: async result => {
      await utils.backups.overview.invalidate();
      toast.success(`Restore verification succeeded for ${result.byteSize} bytes.`);
      setSelectedRunId(null);
      setConfirmation("");
    },
    onError: error => toast.error(error.message),
  });
  const destinationMap = useMemo(
    () => new Map((overview.data?.destinations || []).map(item => [item.id, item])),
    [overview.data?.destinations],
  );
  const eligible = (overview.data?.runs || []).filter(item => item.runType === "backup" && item.status === "succeeded");

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Administration" title="Restore History" description="Review retained backup manifests and run guarded checksum verification before any external recovery workflow." icon={ArchiveRestore} />
      <Alert className="border-[#5A92C9]/25 bg-[#5A92C9]/5"><ShieldCheck className="h-4 w-4 text-[#5A92C9]" /><AlertTitle>Safe restore control</AlertTitle><AlertDescription>The portal downloads the retained manifest and verifies its SHA-256 checksum. It does not overwrite SharePoint, OneDrive, or production source data. Destructive source restoration requires a separately approved runbook and worker.</AlertDescription></Alert>
      {overview.error ? <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertTitle>Restore history could not be loaded</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}

      <Card className="border-0 shadow-soft">
        <CardHeader><CardTitle>Restorable backup manifests</CardTitle></CardHeader>
        <CardContent>
          {eligible.length ? <div className="space-y-3">{eligible.map(item => <div key={item.id} className="grid items-center gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_180px_140px]"><div><div className="flex items-center gap-2"><p className="font-bold">{item.artifactName}</p><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">verified</Badge></div><p className="mt-1 text-xs text-muted-foreground">{destinationMap.get(item.destinationId)?.displayName || "Unknown destination"} · {item.byteSize || 0} bytes · {new Date(item.startedAt).toLocaleString()}</p></div><code className="truncate text-xs text-muted-foreground">{item.checksumSha256}</code><Button variant="outline" onClick={() => { setSelectedRunId(item.id); setConfirmation(""); }}><RotateCcw className="mr-2 h-4 w-4" />Verify restore</Button></div>)}</div> : <div className="py-14 text-center"><ArchiveRestore className="mx-auto h-8 w-8 text-[#5A92C9]" /><p className="mt-3 font-bold">No retained backup manifests</p><p className="mt-1 text-sm text-muted-foreground">Run a Backup Manifest operation from the Backup Center first.</p></div>}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardHeader><CardTitle>Immutable operation audit stream</CardTitle><p className="text-sm text-muted-foreground">Every state transition is appended as a separate event. The application exposes no update or delete operation for this table.</p></CardHeader>
        <CardContent>
          {overview.data?.auditEvents.length ? <div className="space-y-2">{overview.data.auditEvents.map(item => <div key={item.id} className="grid gap-3 rounded-xl border border-border px-4 py-3 md:grid-cols-[150px_140px_1fr_180px]"><div className="flex items-center gap-2"><FileClock className="h-4 w-4 text-[#5A92C9]" /><span className="text-xs font-bold uppercase tracking-[0.08em]">{item.eventType.replaceAll("_", " ")}</span></div><Badge variant="outline" className={auditStatusClass(item.status)}>{item.status}</Badge><p className="text-sm text-muted-foreground">{item.message}</p><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No append-only audit events have been recorded.</p>}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-soft">
        <CardHeader><CardTitle>Current restore execution state</CardTitle></CardHeader>
        <CardContent>{overview.data?.restores.length ? <div className="space-y-2">{overview.data.restores.map(item => <div key={item.id} className="grid gap-3 rounded-xl border border-border px-4 py-3 md:grid-cols-[120px_1fr_180px]"><Badge variant="outline" className={auditStatusClass(item.status)}>{item.status === "succeeded" ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />}{item.status}</Badge><p className="text-sm text-muted-foreground">{item.message || "Restore request recorded"}</p><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No restore verification requests have been recorded.</p>}</CardContent>
      </Card>

      <Dialog open={Boolean(selectedRunId)} onOpenChange={open => !open && setSelectedRunId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Confirm restore verification</DialogTitle><DialogDescription>This reads the retained artifact and validates its checksum. Type <strong>RESTORE</strong> to continue.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>Confirmation</Label><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="RESTORE" autoComplete="off" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedRunId(null)}>Cancel</Button><Button variant="destructive" disabled={confirmation !== "RESTORE" || restore.isPending} onClick={() => selectedRunId && restore.mutate({ backupRunId: selectedRunId, confirmationValue: "RESTORE" })}>{restore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Verify restore</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
