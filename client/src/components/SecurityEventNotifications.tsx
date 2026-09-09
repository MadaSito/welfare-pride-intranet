import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Activity, CheckCircle2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

function eventLabel(eventType: string) { return eventType.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }

export function SecurityEventNotifications() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const unread = trpc.securityCenter.unreadEvents.useQuery(undefined, { refetchInterval: 30_000 });
  const markRead = trpc.securityCenter.markEventsRead.useMutation({ onSuccess: () => utils.securityCenter.unreadEvents.invalidate() });
  const unreadCount = unread.data?.unreadCount || 0;

  return <DropdownMenu onOpenChange={open => { if (open && unreadCount) markRead.mutate(); }}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-xl border-[#5A92C9]/25 bg-white text-[#376F9F] hover:bg-[#5A92C9]/7" aria-label={unreadCount ? `${unreadCount} unread security event${unreadCount === 1 ? "" : "s"}` : "Security events"}>
        <Activity className="h-4 w-4" aria-hidden="true" />
        {unreadCount ? <Badge className="absolute -right-2 -top-2 h-5 min-w-5 rounded-full border-2 border-white bg-[#5A92C9] px-1 text-[10px] font-bold leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</Badge> : null}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-2"><DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2"><span>Security events</span>{unreadCount ? <Badge variant="outline" className="border-[#5A92C9]/30 bg-[#5A92C9]/5 text-[#376F9F]">{unreadCount} unread</Badge> : <span className="text-xs font-normal text-muted-foreground">Up to date</span>}</DropdownMenuLabel><DropdownMenuSeparator />{unread.isLoading ? <div className="flex items-center gap-2 px-3 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading events…</div> : null}{!unread.isLoading && !unread.data?.events.length ? <div className="px-3 py-6 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />No unread security events.</div> : null}<div className="max-h-80 space-y-1 overflow-y-auto">{unread.data?.events.map(({ event }) => <button key={event.id} onClick={() => setLocation(`/admin/security?correlation=${encodeURIComponent(event.correlationId)}&event=${event.id}`)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#5A92C9]/7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="mt-0.5 rounded-lg bg-[#5A92C9]/10 p-2 text-[#376F9F]"><Activity className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{eventLabel(event.eventType)}</span><span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">{event.severity} · {event.ipAddress || "IP unavailable"}</span></span></button>)}</div><DropdownMenuSeparator /><button onClick={() => setLocation("/admin/security")} className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#376F9F] hover:bg-[#5A92C9]/7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Security Center</button></DropdownMenuContent>
  </DropdownMenu>;
}
