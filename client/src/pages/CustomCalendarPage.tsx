import { RestrictedAccessCard } from "@/components/RestrictedAccessCard";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useRoute } from "wouter";

export default function CustomCalendarPage() {
  const [, params] = useRoute("/calendars/:slug");
  const slug = params?.slug || "";
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const range = useMemo(() => ({ from: format(startOfWeek(startOfMonth(month)), "yyyy-MM-dd"), to: format(endOfWeek(endOfMonth(month)), "yyyy-MM-dd") }), [month]);
  const page = trpc.calendars.pageOverview.useQuery({ slug, ...range }, { enabled: Boolean(slug) });
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);

  if (page.isLoading) return <div className="space-y-5"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-[34rem] rounded-2xl" /></div>;
  if (page.error?.data?.code === "FORBIDDEN") return <RestrictedAccessCard resourceKey={`calendar:${slug}`} title="this calendar page" />;
  if (page.error) return <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Calendar is unavailable</AlertTitle><AlertDescription>{page.error.message}</AlertDescription></Alert>;

  const data = page.data;
  const eventsFor = (date: Date) => (data?.events || []).filter(event => format(new Date(event.startAt), "yyyy-MM-dd") === format(date, "yyyy-MM-dd"));
  const holidaysFor = (date: Date) => (data?.holidays || []).filter(holiday => {
    const key = format(date, "yyyy-MM-dd");
    return key >= format(new Date(holiday.startDate), "yyyy-MM-dd") && key <= format(new Date(holiday.endDate), "yyyy-MM-dd");
  });
  const birthdaysFor = (date: Date) => (data?.birthdays || []).filter(birthday => birthday.month === date.getMonth() + 1 && birthday.day === date.getDate());

  return <div className="space-y-7">
    <PageHeader eyebrow={data?.resource.navigationGroup || "Portal calendar"} title={data?.resource.label || "Calendar"} description={data?.resource.body || "Review upcoming dates and shared events."} icon={CalendarDays} />
    {data?.status === "unconfigured" && data.resource.calendarView === "all" ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>SharePoint holiday sync is not configured</AlertTitle><AlertDescription>{data.message}</AlertDescription></Alert> : null}
    <Card className="overflow-hidden border-0 shadow-soft">
      <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5A92C9]">Monthly view</p><CardTitle className="mt-2 text-xl">{format(month, "MMMM yyyy")}</CardTitle></div><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(current => subMonths(current, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button><Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(current => addMonths(current, 1))}><ChevronRight className="h-4 w-4" /></Button></div></CardHeader>
      <CardContent className="p-0"><div className="grid grid-cols-7 border-b border-border/70 bg-muted/40 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} className="px-2 py-3">{day}</div>)}</div><div className="grid grid-cols-7">{days.map(date => { const events = eventsFor(date); const holidays = holidaysFor(date); const birthdays = birthdaysFor(date); return <div key={date.toISOString()} className={`min-h-28 border-b border-r border-border/60 p-2 align-top ${isSameMonth(date, month) ? "bg-white" : "bg-muted/25 text-muted-foreground/55"}`}><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "bg-[#5A92C9] text-white" : ""}`}>{date.getDate()}</span><div className="mt-1 space-y-1">{holidays.slice(0, 1).map(item => <span key={`holiday-${item.id}`} className="block truncate rounded bg-[#5A92C9]/10 px-1.5 py-1 text-[10px] font-medium text-[#376F9F]">{item.title}</span>)}{birthdays.slice(0, 1).map(item => <span key={`birthday-${item.profileId}`} className="block truncate rounded bg-[#D58240]/10 px-1.5 py-1 text-[10px] font-medium text-[#9A5727]">Birthday · {item.displayName}</span>)}{events.slice(0, 2).map(item => <span key={`event-${item.id}`} className="block truncate rounded bg-muted px-1.5 py-1 text-[10px] font-medium">{item.title}</span>)}</div></div>; })}</div></CardContent>
    </Card>
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{data?.events.length || 0} events in view</Badge>{data?.resource.calendarView === "all" ? <><Badge variant="outline">{data.holidays.length} holidays in view</Badge><Badge variant="outline">{data.birthdays.length} birthday profiles</Badge></> : <Badge variant="outline">Events-only calendar</Badge>}</div>
  </div>;
}
