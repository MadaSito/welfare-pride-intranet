import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function SecurityEscalationOwnersPanel() {
  const utils = trpc.useUtils();
  const roster = trpc.securityCenter.escalationOwners.useQuery();
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  useEffect(() => { if (roster.data) setOwnerIds(roster.data.owners.map(owner => owner.userId)); }, [roster.data]);
  const save = trpc.securityCenter.saveEscalationOwners.useMutation({
    onSuccess: async owners => { setOwnerIds(owners.map(owner => owner.userId)); await Promise.all([utils.securityCenter.escalationOwners.invalidate(), utils.securityCenter.alertNotifications.invalidate()]); toast.success("Escalation owners updated and recorded."); },
    onError: error => toast.error(error.message),
  });
  const toggle = (userId: number, checked: boolean) => setOwnerIds(current => checked ? Array.from(new Set([...current, userId])) : current.filter(id => id !== userId));

  return <Card className="border-0 shadow-soft"><CardHeader className="border-b border-border/70"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Alert routing</p><CardTitle className="mt-2">Escalation owners</CardTitle><p className="mt-1 text-sm text-muted-foreground">Select the administrators who receive future threshold alerts and may be assigned to critical incident cases. If no owner is selected, threshold alerts fall back to all administrators.</p></div><Badge variant="outline" className="w-fit border-[#D58240]/30 bg-[#D58240]/5 text-[#9A5727]">{ownerIds.length} assigned</Badge></div></CardHeader><CardContent className="p-5">{roster.isLoading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading administrator roster…</div> : null}{roster.data?.administrators.length ? <div className="space-y-3">{roster.data.administrators.map(administrator => <label key={administrator.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-[#5A92C9]/5"><Checkbox checked={ownerIds.includes(administrator.id)} onCheckedChange={checked => toggle(administrator.id, checked === true)} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold"><UserRoundCheck className="h-4 w-4 text-[#5A92C9]" />{administrator.name || administrator.email}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{administrator.email}</span></span></label>)}</div> : null}{!roster.isLoading && !roster.data?.administrators.length ? <div className="py-6 text-center text-sm text-muted-foreground"><ShieldAlert className="mx-auto mb-2 h-5 w-5 text-[#D58240]" />No eligible administrator accounts are available.</div> : null}<Button className="mt-5 bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" disabled={save.isPending || !roster.data?.administrators.length} onClick={() => save.mutate({ userIds: ownerIds })}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundCheck className="mr-2 h-4 w-4" />}Save escalation owners</Button></CardContent></Card>;
}
