import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookmarkCheck, BriefcaseBusiness, CalendarClock, CalendarDays, CloudCog, ExternalLink, FileText, Link2, Loader2, LockKeyhole, Megaphone, Network, ShieldCheck, Trash2, UserCheck, Users } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const modules = [
  { title: "Employee Directory", description: "Find colleagues and view approved profile details.", icon: Users, path: "/people", accent: "blue" },
  { title: "Organization Chart", description: "Explore reporting relationships across Welfare Pride.", icon: Network, path: "/organization", accent: "orange" },
  { title: "Human Resources", description: "Open policy and employee documents through SharePoint.", icon: FileText, path: "/hr", accent: "blue" },
  { title: "Company Calendar", description: "See holidays, birthdays, events, and important dates.", icon: CalendarDays, path: "/calendars", accent: "orange" },
] as const;

const integrations = [
  { label: "Microsoft Entra ID", description: "Identity and employee directory", status: "Configuration required" },
  { label: "Microsoft Graph", description: "Profiles and organizational relationships", status: "Configuration required" },
  { label: "SharePoint", description: "HR documents and company holidays", status: "Configuration required" },
] as const;

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const pins = trpc.dashboardPins.list.useQuery();
  const portalNavigation = trpc.portalAccess.navigation.useQuery();
  const accessOverview = trpc.portalAccess.adminOverview.useQuery(undefined, { enabled: user?.role === "admin" });
  const businessResource = accessOverview.data?.resources.find(resource => resource.resourceKey === "module:business-management");
  const businessAssignments = trpc.portalAccess.adminAssignments.useQuery(
    { resourceId: businessResource?.id || 1 },
    { enabled: user?.role === "admin" && Boolean(businessResource?.id) },
  );
  const utils = trpc.useUtils();
  const removePin = trpc.dashboardPins.remove.useMutation({
    onSuccess: async () => {
      await utils.dashboardPins.list.invalidate();
      toast.success("Item removed from your dashboard.");
    },
    onError: error => toast.error(error.message),
  });
  const firstName = user?.name?.split(" ")[0] || "there";
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const businessUsers = (businessAssignments.data || []).filter(item => item.userId).map(item => accessOverview.data?.users.find(userItem => userItem.id === item.userId)).filter(Boolean);
  const businessGroups = (businessAssignments.data || []).filter(item => item.entraGroupId).map(item => accessOverview.data?.groups.find(group => group.groupId === item.entraGroupId)).filter(Boolean);
  const visibleModulePaths = new Set((portalNavigation.data?.resources || []).map(resource => resource.path));
  const visibleWorkspaceModules = modules.filter(module => visibleModulePaths.has(module.path));

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] bg-[#5A92C9] p-6 text-white shadow-soft sm:p-8 lg:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[46px] border-white/10" />
        <div className="absolute -bottom-20 right-32 h-48 w-48 rounded-full bg-[#D58240]/80" />
        <div className="relative z-10 max-w-3xl">
          <Badge className="border border-white/20 bg-white/12 text-white hover:bg-white/12">{today}</Badge>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.045em] sm:text-4xl lg:text-[2.85rem]">Good to see you, {firstName}.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
            Your Welfare Pride workspace brings people, company updates, important dates, and Microsoft 365 resources together in one secure employee hub.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button className="bg-white font-semibold text-[#376F9F] hover:bg-white/90" onClick={() => setLocation("/links")}>Open important links <ArrowRight className="ml-2 h-4 w-4" /></Button>
            <Button variant="outline" className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setLocation("/announcements")}>View announcements</Button>
          </div>
        </div>
      </section>

      {user?.role === "admin" ? <section aria-labelledby="business-access-heading">
        <Card className="overflow-hidden border-0 shadow-soft">
          <CardHeader className="border-b border-[#D58240]/18 bg-gradient-to-r from-[#D58240]/10 to-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D58240] text-white shadow-sm"><BriefcaseBusiness className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9A5727]">Administrator overview</p>
                  <CardTitle id="business-access-heading" className="mt-1 text-xl">Business Management access</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Review the people and Entra groups currently authorized for this restricted section.</p>
                </div>
              </div>
              <Button className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" onClick={() => setLocation("/admin/access-pages?resource=business-management")}><UserCheck className="mr-2 h-4 w-4" />Manage access</Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {accessOverview.isLoading || businessAssignments.isLoading ? <div className="grid gap-3 sm:grid-cols-2"><div className="h-20 animate-pulse rounded-xl bg-muted" /><div className="h-20 animate-pulse rounded-xl bg-muted" /></div> : null}
            {accessOverview.error || businessAssignments.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Business Management assignments could not be loaded. Open Access & Pages to retry.</div> : null}
            {businessResource && !accessOverview.isLoading && !businessAssignments.isLoading ? <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-[#D58240]/22 bg-[#D58240]/5 p-4"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#D58240]" /><p className="font-semibold">{businessResource.accessMode === "restricted" ? "Restricted audience" : "All authenticated employees"}</p></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{businessResource.accessMode === "restricted" ? "Access is granted only by named user or synchronized Entra group membership." : "Every signed-in employee can open this section."}</p><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline" className="border-[#5A92C9]/25 bg-white text-[#376F9F]">{businessUsers.length} named user{businessUsers.length === 1 ? "" : "s"}</Badge><Badge variant="outline" className="border-[#D58240]/25 bg-white text-[#9A5727]">{businessGroups.length} Entra group{businessGroups.length === 1 ? "" : "s"}</Badge></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border/80 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5A92C9]">Named users</p>{businessUsers.length ? <ul className="mt-3 space-y-2">{businessUsers.slice(0, 4).map(userItem => <li key={userItem!.id} className="truncate text-sm font-semibold">{userItem!.name || userItem!.email || `User ${userItem!.id}`}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No direct user assignments.</p>}</div><div className="rounded-2xl border border-border/80 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D58240]">Entra groups</p>{businessGroups.length ? <ul className="mt-3 space-y-2">{businessGroups.slice(0, 4).map(group => <li key={group!.groupId} className="truncate text-sm font-semibold">{group!.displayName}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No group assignments.</p>}</div></div>
            </div> : null}
          </CardContent>
        </Card>
      </section> : null}

      <section aria-labelledby="personalized-dashboard-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#D58240]">Personalized dashboard</p>
            <h2 id="personalized-dashboard-heading" className="mt-1 text-xl font-bold tracking-[-0.02em]">Your pinned resources and events</h2>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">Pin items from Human Resources or Events. Your choices are private to your account.</p>
        </div>

        {pins.isLoading ? <div className="grid gap-4 lg:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl bg-white shadow-soft" /><div className="h-52 animate-pulse rounded-2xl bg-white shadow-soft" /></div> : null}
        {pins.error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Your personalized dashboard could not be loaded.</div> : null}
        {pins.data ? <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-soft">
            <CardHeader className="flex-row items-center justify-between border-b border-border/70"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5A92C9]">Quick access</p><CardTitle className="mt-1 text-lg">Pinned HR resources</CardTitle></div><FileText className="h-5 w-5 text-[#5A92C9]" /></CardHeader>
            <CardContent className="p-4">{pins.data.documents.length ? <div className="space-y-2">{pins.data.documents.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5A92C9]/10 text-[#5A92C9]"><BookmarkCheck className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.category}</p></div><Button asChild variant="ghost" size="icon" className="h-8 w-8 text-[#376F9F]"><a href={item.webUrl} target="_blank" rel="noreferrer" aria-label={`Open ${item.name}`}><ExternalLink className="h-4 w-4" /></a></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Unpin ${item.name}`} onClick={() => removePin.mutate({ pinType: "hr_document", targetKey: item.id })} disabled={removePin.isPending}>{removePin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>)}</div> : <div className="rounded-xl border border-dashed border-[#5A92C9]/25 bg-[#5A92C9]/5 p-6 text-center"><FileText className="mx-auto h-6 w-6 text-[#5A92C9]" /><p className="mt-3 text-sm font-semibold">No HR resources pinned</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Pin frequently used policies, forms, and employee resources from the HR library.</p><Button variant="link" className="mt-1 text-[#376F9F]" onClick={() => setLocation("/hr")}>Browse HR resources</Button></div>}</CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardHeader className="flex-row items-center justify-between border-b border-border/70"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D58240]">Coming up</p><CardTitle className="mt-1 text-lg">Pinned events</CardTitle></div><CalendarClock className="h-5 w-5 text-[#D58240]" /></CardHeader>
            <CardContent className="p-4">{pins.data.events.length ? <div className="space-y-2">{pins.data.events.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#D58240]/10 text-[#9A5727]"><span className="text-[9px] font-bold uppercase">{new Date(item.startAt).toLocaleString(undefined, { month: "short" })}</span><span className="text-sm font-bold leading-none">{new Date(item.startAt).getDate()}</span></div><button className="min-w-0 flex-1 text-left" onClick={() => setLocation(`/events?event=${item.id}`)}><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{new Date(item.startAt).toLocaleString()}</span></button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Unpin ${item.title}`} onClick={() => removePin.mutate({ pinType: "event", targetKey: String(item.id) })} disabled={removePin.isPending}>{removePin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>)}</div> : <div className="rounded-xl border border-dashed border-[#D58240]/25 bg-[#D58240]/5 p-6 text-center"><CalendarDays className="mx-auto h-6 w-6 text-[#D58240]" /><p className="mt-3 text-sm font-semibold">No upcoming events pinned</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Keep important meetings, celebrations, and learning sessions close at hand.</p><Button variant="link" className="mt-1 text-[#9A5727]" onClick={() => setLocation("/events")}>Browse events</Button></div>}</CardContent>
          </Card>
        </div> : null}
        {pins.data?.unavailableCount ? <p className="mt-3 text-xs text-muted-foreground">{pins.data.unavailableCount} pinned item{pins.data.unavailableCount === 1 ? " is" : "s are"} hidden because it expired, was removed, or is no longer authorized.</p> : null}
      </section>

      <section aria-labelledby="workspace-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#D58240]">Employee workspace</p>
            <h2 id="workspace-heading" className="mt-1 text-xl font-bold tracking-[-0.02em]">Start where you need to go</h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {portalNavigation.isLoading ? <><div className="h-48 animate-pulse rounded-2xl bg-white shadow-soft" /><div className="h-48 animate-pulse rounded-2xl bg-white shadow-soft" /></> : null}
          {!portalNavigation.isLoading && visibleWorkspaceModules.map(module => (
            <button key={module.path} onClick={() => setLocation(module.path)} className="group rounded-2xl bg-white p-5 text-left shadow-soft ring-1 ring-border/60 hover:-translate-y-0.5 hover:ring-[#5A92C9]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A92C9]">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${module.accent === "blue" ? "bg-[#5A92C9]/10 text-[#5A92C9]" : "bg-[#D58240]/10 text-[#D58240]"}`}>
                <module.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-bold">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#376F9F]">Open module <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </button>
          ))}
          {!portalNavigation.isLoading && !visibleWorkspaceModules.length ? <div className="rounded-2xl border border-dashed border-[#5A92C9]/25 bg-white p-6 text-sm text-muted-foreground sm:col-span-2">Your administrator has not assigned additional workspace modules to this account. Use the resources available in your navigation menu or request access to a restricted page.</div> : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-0 shadow-soft">
          <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/70">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#D58240]">Company pulse</p>
              <CardTitle className="mt-2 text-xl">Latest from Welfare Pride</CardTitle>
            </div>
            <Megaphone className="h-5 w-5 text-[#5A92C9]" aria-hidden="true" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-[#5A92C9]/5 p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#5A92C9] shadow-sm"><Megaphone className="h-5 w-5" /></div>
              <h3 className="mt-4 font-bold">No published announcements yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Published company updates will appear here. Administrators can create and schedule announcements from the Announcements workspace.</p>
              <Button variant="link" className="mt-2 text-[#376F9F]" onClick={() => setLocation("/announcements")}>Open announcements <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#D58240]">System readiness</p>
                <CardTitle className="mt-2 text-xl">Microsoft 365 connections</CardTitle>
              </div>
              <CloudCog className="h-5 w-5 text-[#5A92C9]" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 p-4">
            {integrations.map(integration => (
              <div key={integration.label} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 hover:bg-muted/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{integration.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{integration.description}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-[#D58240]/25 bg-[#D58240]/5 text-[10px] text-[#9A5727]">Setup needed</Badge>
              </div>
            ))}
            {user?.role === "admin" ? <Button variant="ghost" className="mt-2 w-full justify-between text-[#376F9F]" onClick={() => setLocation("/admin/integrations")}>Configure integrations <ArrowRight className="h-4 w-4" /></Button> : null}
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <button onClick={() => setLocation("/events")} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 text-left shadow-sm hover:border-[#5A92C9]/35">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5A92C9]/10 text-[#5A92C9]"><CalendarDays className="h-5 w-5" /></div>
          <div><p className="font-semibold">Upcoming events</p><p className="mt-1 text-xs text-muted-foreground">No published events</p></div>
        </button>
        <button onClick={() => setLocation("/links")} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 text-left shadow-sm hover:border-[#5A92C9]/35">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D58240]/10 text-[#D58240]"><Link2 className="h-5 w-5" /></div>
          <div><p className="font-semibold">Microsoft 365 tools</p><p className="mt-1 text-xs text-muted-foreground">Email, calendar, and apps</p></div>
        </button>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5A92C9]/10 text-[#5A92C9]"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="font-semibold">Secure employee access</p><p className="mt-1 text-xs text-muted-foreground">Protected application session</p></div>
        </div>
      </section>
    </div>
  );
}
