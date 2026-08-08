import { useAuth } from "@/_core/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { GlobalSearch } from "@/components/GlobalSearch";
import { WelfarePrideAssistant } from "@/components/WelfarePrideAssistant";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArchiveRestore, CalendarDays, CalendarHeart, CloudCog, FileText, Home, Info, KeyRound, Laptop, Link2, Loader2, LogOut, Megaphone, Network, PanelLeftClose, Search, Settings, ShieldCheck, Users, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type NavItem = { icon: LucideIcon; label: string; path: string };
type NavGroup = { label: string; items: NavItem[] };

const navigationGroups: NavGroup[] = [
  {
    label: "Workplace",
    items: [
      { icon: Home, label: "Dashboard", path: "/" },
      { icon: Megaphone, label: "Announcements", path: "/announcements" },
      { icon: CalendarDays, label: "Events", path: "/events" },
      { icon: Link2, label: "Important Links", path: "/links" },
    ],
  },
  {
    label: "People",
    items: [
      { icon: Users, label: "Employee Directory", path: "/people" },
      { icon: Network, label: "Organization Chart", path: "/organization" },
      { icon: CalendarHeart, label: "Calendars", path: "/calendars" },
    ],
  },
  {
    label: "Company",
    items: [
      { icon: FileText, label: "Human Resources", path: "/hr" },
      { icon: Info, label: "About Welfare Pride", path: "/about" },
      { icon: UsersRound, label: "Founders", path: "/founders" },
      { icon: Laptop, label: "Technology", path: "/technology" },
    ],
  },
] ;

const adminItems: NavItem[] = [
  { icon: Settings, label: "Integration Settings", path: "/admin/integrations" },
  { icon: CloudCog, label: "Backup Center", path: "/admin/backups" },
  { icon: ArchiveRestore, label: "Restore History", path: "/admin/restores" },
] ;

function SignInScreen() {
  const [authStatus, setAuthStatus] = useState<{ configured: boolean; protocols: { oidc: boolean; oauth2: boolean; saml2: boolean; silentSignIn: boolean } } | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const utils = trpc.useUtils();
  const localStatus = trpc.auth.status.useQuery(undefined, { retry: false });
  const setupOwner = trpc.auth.setupOwner.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.assign("/");
    },
  });
  const localLogin = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.assign("/");
    },
  });
  const authError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("authError") : null;
  const setupRequired = localStatus.data?.setupRequired ?? false;
  const localPending = setupOwner.isPending || localLogin.isPending;
  const localError = setupOwner.error?.message || localLogin.error?.message;

  const submitLocalAccess = (event: React.FormEvent) => {
    event.preventDefault();
    if (setupRequired) setupOwner.mutate({ name: ownerName, email, password, setupToken });
    else localLogin.mutate({ email, password });
  };

  useEffect(() => {
    let active = true;
    fetch("/api/auth/microsoft/status", { credentials: "same-origin" })
      .then(response => {
        if (!response.ok) throw new Error("Authentication status unavailable");
        return response.json();
      })
      .then(data => { if (active) setAuthStatus(data); })
      .catch(() => { if (active) setStatusError(true); });
    return () => { active = false; };
  }, []);

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.08fr_0.92fr]">
      <section className="brand-grid relative hidden overflow-hidden bg-[#5A92C9] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-24 h-80 w-80 rounded-full border-[52px] border-white/10" />
        <div className="absolute -bottom-24 left-24 h-72 w-72 rounded-full bg-[#D58240]/80 blur-[1px]" />
        <BrandLogo variant="full" className="relative z-10 h-20 w-auto max-w-[310px] rounded-xl bg-white/95 p-3" />
        <div className="relative z-10 max-w-xl pb-10">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-white/80">One connected workplace</p>
          <h1 className="text-5xl font-bold leading-[1.02] tracking-[-0.045em]">Everything your workday needs, in one trusted place.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/85">
            Access company news, people, calendars, Human Resources documents, and Microsoft 365 resources through the secure Welfare Pride employee hub.
          </p>
        </div>
        <p className="relative z-10 text-xs font-medium text-white/70">Private system · Authorized Welfare Pride employees only</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <BrandLogo variant="full" className="mb-10 h-16 w-auto max-w-[280px] lg:hidden" />
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D58240]">Employee sign in</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-black">Welcome to Welfare Pride</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in with the local owner account or your organizational Microsoft account. The owner account lets you configure Microsoft Entra after deployment.
          </p>

          {authError ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Microsoft sign-in could not be completed. Try again or contact a Welfare Pride administrator with error code <strong>{authError}</strong>.</div> : null}
          {!authStatus?.configured && authStatus ? <div className="mt-5 rounded-xl border border-[#D58240]/25 bg-[#D58240]/5 p-3 text-sm text-[#7A431F]">Enterprise sign-in is not configured yet. Use the local owner account below, then open Integration Settings to add Entra.</div> : null}
          {statusError ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">The sign-in configuration status is temporarily unavailable.</div> : null}

          <form className="mt-7 space-y-4 rounded-2xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-5" onSubmit={submitLocalAccess}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#5A92C9] shadow-sm"><KeyRound className="h-4 w-4" aria-hidden="true" /></div>
              <div><p className="font-semibold text-foreground">{setupRequired ? "Create the owner account" : "Local administrator sign in"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{setupRequired ? "This one-time step unlocks Integration Settings before Entra is available." : "Use the owner credentials created during first-time setup."}</p></div>
            </div>
            {setupRequired ? <div className="space-y-2"><Label htmlFor="owner-name">Owner name</Label><Input id="owner-name" autoComplete="name" value={ownerName} onChange={event => setOwnerName(event.target.value)} required /></div> : null}
            <div className="space-y-2"><Label htmlFor="local-email">Email address</Label><Input id="local-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="local-password">Password</Label><Input id="local-password" type="password" autoComplete={setupRequired ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} minLength={setupRequired ? 12 : 1} required /><p className="text-xs text-muted-foreground">{setupRequired ? "Use 12–128 characters with uppercase, lowercase, number, and symbol." : "Five failed attempts temporarily lock the account."}</p></div>
            {setupRequired ? <div className="space-y-2"><Label htmlFor="setup-token">One-time setup token</Label><Input id="setup-token" type="password" autoComplete="off" value={setupToken} onChange={event => setSetupToken(event.target.value)} required /><p className="text-xs text-muted-foreground">Set <code>INITIAL_SETUP_TOKEN</code> in Hostinger before deployment, then enter the same value here.</p></div> : null}
            {setupRequired && localStatus.data && !localStatus.data.setupTokenConfigured ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">The server is missing <code>INITIAL_SETUP_TOKEN</code>. Add it in Hostinger environment variables and redeploy before continuing.</div> : null}
            {localError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError}</div> : null}
            <Button type="submit" className="h-11 w-full bg-[#D58240] font-semibold text-white hover:bg-[#D58240]/90" disabled={localPending || localStatus.isLoading || (setupRequired && !localStatus.data?.setupTokenConfigured)}>{localPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}{setupRequired ? "Create owner account" : "Sign in as administrator"}</Button>
          </form>

          <div className="my-7 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>Microsoft enterprise sign in</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              className="h-12 w-full bg-[#5A92C9] text-base font-semibold text-white hover:bg-[#5A92C9]/90"
              onClick={() => window.location.assign("/api/auth/microsoft/start?mode=interactive")}
              disabled={!authStatus?.protocols.oidc}
            >
              <span className="mr-3 grid grid-cols-2 gap-0.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 bg-white" />
                <span className="h-2.5 w-2.5 bg-white" />
                <span className="h-2.5 w-2.5 bg-white" />
                <span className="h-2.5 w-2.5 bg-white" />
              </span>
              Continue with OpenID Connect
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full border-[#5A92C9]/35 bg-white font-semibold text-[#376F9F] hover:bg-[#5A92C9]/5"
              onClick={() => window.location.assign("/api/auth/microsoft/start?mode=silent")}
              disabled={!authStatus?.protocols.silentSignIn}
            >
              Use existing work session
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full border-[#D58240]/40 bg-white font-semibold text-[#8A4D25] hover:bg-[#D58240]/5"
              onClick={() => window.location.assign("/api/auth/microsoft/saml/start")}
              disabled={!authStatus?.protocols.saml2}
            >
              Continue with SAML 2.0
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Configured authentication protocols">
            {[{ label: "OIDC", ready: authStatus?.protocols.oidc }, { label: "OAuth 2.0", ready: authStatus?.protocols.oauth2 }, { label: "SAML 2.0", ready: authStatus?.protocols.saml2 }, { label: "Silent SSO", ready: authStatus?.protocols.silentSignIn }].map(protocol => <Badge key={protocol.label} variant="outline" className={protocol.ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-muted/50 text-muted-foreground"}>{protocol.label} · {protocol.ready ? "ready" : "setup needed"}</Badge>)}
          </div>

          <div className="mt-8 rounded-2xl border border-[#5A92C9]/15 bg-[#5A92C9]/5 p-4">
            <p className="text-xs leading-5 text-muted-foreground">
              Sign-in uses SAML 2.0 or OpenID Connect for enterprise identity and OAuth 2.0 for authorized Microsoft Graph access. Credentials are never stored in this browser.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <SignInScreen />;

  return (
    <SidebarProvider style={{ "--sidebar-width": "17.5rem", "--sidebar-width-icon": "4.75rem" } as CSSProperties}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const allItems = useMemo(() => [...navigationGroups.flatMap(group => group.items), ...(user?.role === "admin" ? adminItems : [])], [user?.role]);
  const activeItem = allItems.find(item => item.path === "/" ? location === "/" : location.startsWith(item.path));

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-white">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <div className="flex h-12 items-center justify-between gap-2">
            <button
              onClick={() => setLocation("/")}
              className="flex min-w-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Welfare Pride dashboard"
            >
              {isCollapsed ? <BrandLogo variant="icon" className="h-10 w-10" /> : <BrandLogo variant="full" className="h-11 w-auto max-w-[205px]" />}
            </button>
            {!isCollapsed ? (
              <button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Collapse navigation">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          {navigationGroups.map(group => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground/75">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(item => {
                    const active = item.path === "/" ? location === "/" : location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={active}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={cn("h-10 rounded-xl px-3 font-medium", active && "bg-[#5A92C9]/12 text-[#376F9F]")}
                        >
                          <item.icon className={cn("h-[18px] w-[18px]", active ? "text-[#5A92C9]" : "text-muted-foreground")} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {user?.role === "admin" ? (
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-[#D58240]">Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map(item => {
                    const active = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton isActive={active} onClick={() => setLocation(item.path)} tooltip={item.label} className={cn("h-10 rounded-xl px-3 font-medium", active && "bg-[#D58240]/10 text-[#9A5727]") }>
                          <item.icon className={cn("h-[18px] w-[18px]", active ? "text-[#D58240]" : "text-muted-foreground")} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 shrink-0 border-2 border-[#5A92C9]/20">
                  <AvatarFallback className="bg-[#5A92C9] text-xs font-bold text-white">{user?.name?.slice(0, 2).toUpperCase() || "WP"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold">{user?.name || "Welfare Pride employee"}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email || "Authenticated account"}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-60">
              <DropdownMenuLabel>
                <div className="flex items-center justify-between gap-3">
                  <span>Account</span>
                  <Badge variant="outline" className="capitalize">{user?.role}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/people/me")} className="cursor-pointer">My profile</DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#F7F9FC]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="h-9 w-9 rounded-xl border border-border bg-white" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{activeItem?.label || "Welfare Pride"}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Employee intranet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <WelfarePrideAssistant isAdmin={user?.role === "admin"} />
            <Badge variant="outline" className="hidden border-[#5A92C9]/25 bg-[#5A92C9]/5 text-[#376F9F] sm:inline-flex"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#5A92C9]" />Secure workspace</Badge>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>

        <footer className="border-t border-border/80 bg-white px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Welfare Pride. Internal use only.</p>
            <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#5A92C9]" />Protected by role-based access and secure sessions</p>
          </div>
        </footer>
      </SidebarInset>
    </>
  );
}
