import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Loader2, Megaphone, Search, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ResultSource = "people" | "announcements" | "hr_documents";

const sourceMeta: Record<ResultSource, { label: string; icon: typeof Search }> = {
  people: { label: "Employees", icon: Users },
  announcements: { label: "Announcements", icon: Megaphone },
  hr_documents: { label: "HR documents", icon: FileText },
};

function SearchBox({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const [, setLocation] = useLocation();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  const input = useMemo(() => ({ query: debounced, limitPerSource: 6 }), [debounced]);
  const results = trpc.search.unified.useQuery(input, { enabled: debounced.length >= 2, retry: false, staleTime: 30_000 });
  const open = focused && value.trim().length >= 2;

  const navigate = (href: string, source: ResultSource) => {
    setFocused(false);
    onNavigate?.();
    if (source === "hr_documents") window.open(href, "_blank", "noopener,noreferrer");
    else setLocation(href);
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={value}
        onChange={event => setValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={event => { if (event.key === "Escape") setFocused(false); }}
        placeholder="Search people, HR documents, announcements…"
        aria-label="Search Welfare Pride"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        className="h-10 border-border bg-[#F7F9FC] pl-9 pr-10 shadow-none focus-visible:bg-white"
      />
      {results.isFetching ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#5A92C9]" aria-hidden="true" /> : null}
      {open ? (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(65vh,34rem)] overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-2xl">
          {results.isLoading ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">Searching Welfare Pride…</p> : null}
          {results.error ? <p role="alert" className="px-3 py-8 text-center text-sm text-red-600">Search is temporarily unavailable.</p> : null}
          {results.data && !results.data.results.length ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results for “{debounced}”.</p> : null}
          {results.data ? (["people", "announcements", "hr_documents"] as ResultSource[]).map(source => {
            const items = results.data.groups[source === "hr_documents" ? "documents" : source];
            if (!items.length) return null;
            const meta = sourceMeta[source];
            return <section key={source} className="py-1"><p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{meta.label}</p>{items.map(item => <button key={item.id} role="option" type="button" onMouseDown={event => event.preventDefault()} onClick={() => navigate(item.href, source)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#5A92C9]/8 focus-visible:bg-[#5A92C9]/8"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5A92C9]/10 text-[#5A92C9]"><meta.icon className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{item.title}</span><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.subtitle}</span></span></button>)}</section>;
          }) : null}
          {results.data?.sourceStatus.documents === "unavailable" ? <p className="mx-2 my-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">HR document search requires a Microsoft sign-in with SharePoint access.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function GlobalSearch() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <SearchBox className="hidden w-[min(38vw,34rem)] md:block" />
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 bg-white md:hidden" aria-label="Open global search"><Search className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent className="top-[12%] translate-y-0 gap-4 sm:max-w-lg">
          <DialogHeader><DialogTitle>Search Welfare Pride</DialogTitle><DialogDescription>Find employees, company announcements, and HR documents you are authorized to access.</DialogDescription></DialogHeader>
          <SearchBox onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
