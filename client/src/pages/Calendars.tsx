import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Cake, CalendarHeart, ChevronLeft, ChevronRight, Gift, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type DayDetails = { date: Date; holidays: Array<{ id: number; title: string; description: string | null }>; birthdays: Array<{ profileId: number; displayName: string; photoUrl: string | null }>; events: Array<{ id: number; title: string; category: string }> };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "WP";
}

export default function Calendars() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<DayDetails | null>(null);
  const range = useMemo(() => ({
    from: format(startOfWeek(startOfMonth(month)), "yyyy-MM-dd"),
    to: format(endOfWeek(endOfMonth(month)), "yyyy-MM-dd"),
  }), [month]);
  const overview = trpc.calendars.overview.useQuery(range);
  const utils = trpc.useUtils();
  const sync = trpc.calendars.syncHolidays.useMutation({
    onSuccess: async result => { await utils.calendars.overview.invalidate(); toast.success(`${result.synchronized} SharePoint holidays synchronized.`); },
    onError: error => toast.error(error.message),
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);

  function detailsFor(date: Date): DayDetails {
    const key = format(date, "yyyy-MM-dd");
    const holidays = (overview.data?.holidays || []).filter(item => {
      const start = format(new Date(item.startDate), "yyyy-MM-dd");
      const end = format(new Date(item.endDate), "yyyy-MM-dd");
      return key >= start && key <= end;
    }).map(item => ({ id: item.id, title: item.title, description: item.description }));
    const birthdays = (overview.data?.birthdays || []).filter(item => item.month === date.getMonth() + 1 && item.day === date.getDate()).map(item => ({ profileId: item.profileId, displayName: item.displayName, photoUrl: item.photoUrl }));
    const events = (overview.data?.events || []).filter(item => format(new Date(item.startAt), "yyyy-MM-dd") === key).map(item => ({ id: item.id, title: item.title, category: item.category }));
    return { date, holidays, birthdays, events };
  }

  const monthBirthdays = (overview.data?.birthdays || []).filter(item => item.month === month.getMonth() + 1);
  const monthHolidays = (overview.data?.holidays || []).filter(item => isSameMonth(new Date(item.startDate), month));

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Celebrate and plan together" title="Holidays & Birthdays" description="See company holidays and recognize employee birthdays while keeping every birth year private." icon={CalendarHeart} actions={user?.role === "admin" ? <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />Synchronize holidays</Button> : undefined} />
      {overview.data?.status === "unconfigured" ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>SharePoint holiday sync is not configured</AlertTitle><AlertDescription>{overview.data.message} Birthday dates can still be maintained as month and day only by an administrator.</AlertDescription></Alert> : null}
      {overview.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Calendar data could not be loaded</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]"><CalendarHeart className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{monthHolidays.length}</p><p className="text-sm text-muted-foreground">Holidays this month</p></div></CardContent></Card>
        <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D58240]/10 text-[#D58240]"><Cake className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{monthBirthdays.length}</p><p className="text-sm text-muted-foreground">Birthdays this month</p></div></CardContent></Card>
        <Card className="border-0 shadow-soft"><CardContent className="flex items-center gap-4 p-5"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]"><Gift className="h-5 w-5" /></div><div><p className="text-sm font-bold">Month and day only</p><p className="mt-1 text-xs text-muted-foreground">Birth years are never returned by the portal API</p></div></CardContent></Card>
      </div>

      <Card className="overflow-hidden border-0 shadow-soft">
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Monthly view</p><CardTitle className="mt-2 text-xl">{format(month, "MMMM yyyy")}</CardTitle></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(current => subMonths(current, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button><Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(current => addMonths(current, 1))}><ChevronRight className="h-4 w-4" /></Button></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <div key={day} className="px-2 py-3">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map(date => {
              const details = detailsFor(date);
              const hasItems = details.holidays.length || details.birthdays.length || details.events.length;
              return <button key={date.toISOString()} onClick={() => hasItems && setSelectedDay(details)} className={`min-h-28 border-b border-r border-border/60 p-2 text-left align-top hover:bg-[#5A92C9]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5A92C9] ${!isSameMonth(date, month) ? "bg-muted/25 text-muted-foreground/55" : "bg-white"}`}><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "bg-[#5A92C9] text-white" : ""}`}>{date.getDate()}</span><div className="mt-1 space-y-1">{details.holidays.slice(0,1).map(item => <span key={`h-${item.id}`} className="block truncate rounded bg-[#5A92C9]/10 px-1.5 py-1 text-[10px] font-medium text-[#376F9F]">{item.title}</span>)}{details.birthdays.slice(0,1).map(item => <span key={`b-${item.profileId}`} className="block truncate rounded bg-[#D58240]/10 px-1.5 py-1 text-[10px] font-medium text-[#9A5727]">Birthday · {item.displayName}</span>)}{details.events.slice(0,1).map(item => <span key={`e-${item.id}`} className="block truncate rounded bg-muted px-1.5 py-1 text-[10px] font-medium">{item.title}</span>)}{(details.holidays.length + details.birthdays.length + details.events.length) > 3 ? <span className="block text-[10px] text-muted-foreground">More</span> : null}</div></button>;
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedDay)} onOpenChange={open => !open && setSelectedDay(null)}><DialogContent className="max-w-lg">{selectedDay ? <><DialogHeader><DialogTitle>{format(selectedDay.date, "EEEE, MMMM d")}</DialogTitle><DialogDescription>Company dates and celebrations for this day.</DialogDescription></DialogHeader><div className="space-y-5">{selectedDay.holidays.map(item => <div key={item.id} className="rounded-xl bg-[#5A92C9]/7 p-4"><Badge className="border-0 bg-[#5A92C9]/10 text-[#376F9F]">Holiday</Badge><h3 className="mt-2 font-bold">{item.title}</h3>{item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}</div>)}{selectedDay.birthdays.map(item => <div key={item.profileId} className="flex items-center gap-3 rounded-xl bg-[#D58240]/7 p-4"><Avatar><AvatarImage src={item.photoUrl || undefined} /><AvatarFallback className="bg-[#D58240]/10 text-[#9A5727]">{initials(item.displayName)}</AvatarFallback></Avatar><div><Badge className="border-0 bg-[#D58240]/10 text-[#9A5727]">Birthday</Badge><h3 className="mt-1 font-bold">{item.displayName}</h3><p className="text-xs text-muted-foreground">Month and day only</p></div></div>)}{selectedDay.events.map(item => <div key={item.id} className="rounded-xl border border-border p-4"><Badge variant="outline">{item.category}</Badge><h3 className="mt-2 font-bold">{item.title}</h3></div>)}</div></> : null}</DialogContent></Dialog>
    </div>
  );
}
