import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, Loader2, UserRound } from "lucide-react";
import { useLocation } from "wouter";

export function AccessRequestNotifications() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const notifications = trpc.portalAccess.adminNotifications.useQuery(undefined, { refetchInterval: 60_000 });
  const markRead = trpc.portalAccess.markAdminNotificationsRead.useMutation({
    onSuccess: () => utils.portalAccess.adminNotifications.invalidate(),
  });
  const unreadCount = notifications.data?.unreadCount || 0;

  return (
    <DropdownMenu onOpenChange={open => { if (open && unreadCount) markRead.mutate(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-xl border-[#5A92C9]/25 bg-white text-[#376F9F] hover:bg-[#5A92C9]/7" aria-label={unreadCount ? `${unreadCount} unread access request notification${unreadCount === 1 ? "" : "s"}` : "Access request notifications"}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount ? <Badge className="absolute -right-2 -top-2 h-5 min-w-5 rounded-full border-2 border-white bg-[#D58240] px-1 text-[10px] font-bold leading-4 text-white">{unreadCount > 9 ? "9+" : unreadCount}</Badge> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-2">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2">
          <span>Access requests</span>
          {unreadCount ? <Badge variant="outline" className="border-[#D58240]/30 bg-[#D58240]/5 text-[#9A5727]">{unreadCount} new</Badge> : <span className="text-xs font-normal text-muted-foreground">Up to date</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.isLoading ? <div className="flex items-center gap-2 px-3 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading notifications…</div> : null}
        {!notifications.isLoading && !notifications.data?.notifications.length ? <div className="px-3 py-6 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />No new access requests.</div> : null}
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {notifications.data?.notifications.map(notification => <button key={notification.id} onClick={() => setLocation("/admin/access-pages?requests=all")} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#5A92C9]/7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="mt-0.5 rounded-lg bg-[#5A92C9]/10 p-2 text-[#376F9F]"><UserRound className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{notification.requesterName || notification.requesterEmail || "Employee"}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Requested {notification.resourceLabel}</span></span>
            {!notification.readAt ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#D58240]" aria-label="Unread" /> : null}
          </button>)}
        </div>
        <DropdownMenuSeparator />
        <button onClick={() => setLocation("/admin/access-pages?requests=all")} className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#376F9F] hover:bg-[#5A92C9]/7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage access requests</button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
