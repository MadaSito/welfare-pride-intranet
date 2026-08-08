import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Bookmark, BookmarkCheck, ExternalLink, File, FileArchive, FileImage, FileSpreadsheet, FileText, Folder, Grid2X2, List, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function formatBytes(value: number) {
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function DocumentIcon({ mimeType, isFolder }: { mimeType: string | null; isFolder: boolean }) {
  if (isFolder) return <Folder className="h-5 w-5" />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return <FileSpreadsheet className="h-5 w-5" />;
  if (mimeType?.includes("image")) return <FileImage className="h-5 w-5" />;
  if (mimeType?.includes("zip") || mimeType?.includes("archive")) return <FileArchive className="h-5 w-5" />;
  if (mimeType?.includes("pdf") || mimeType?.includes("document") || mimeType?.includes("word")) return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

export default function HumanResources() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const input = useMemo(() => ({ query: query.trim() || undefined }), [query]);
  const documents = trpc.documents.list.useQuery(input);
  const pins = trpc.dashboardPins.list.useQuery();
  const utils = trpc.useUtils();
  const categories = useMemo(() => Array.from(new Set((documents.data?.items || []).map(item => item.category))).sort(), [documents.data?.items]);
  const filtered = useMemo(() => (documents.data?.items || []).filter(item => category === "all" || item.category === category), [category, documents.data?.items]);
  const pinnedIds = useMemo(() => new Set(pins.data?.pinnedDocumentIds || []), [pins.data?.pinnedDocumentIds]);
  const pinDocument = trpc.dashboardPins.pinDocument.useMutation({ onSuccess: async () => { await utils.dashboardPins.list.invalidate(); toast.success("HR resource pinned to your dashboard."); }, onError: error => toast.error(error.message) });
  const removePin = trpc.dashboardPins.remove.useMutation({ onSuccess: async () => { await utils.dashboardPins.list.invalidate(); toast.success("HR resource removed from your dashboard."); }, onError: error => toast.error(error.message) });

  function togglePin(documentId: string) {
    if (pinnedIds.has(documentId)) removePin.mutate({ pinType: "hr_document", targetKey: documentId });
    else pinDocument.mutate({ documentId });
  }

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Get the resources you need" title="Human Resources" description="Search and open Welfare Pride policies and employee documents from the authorized SharePoint library." icon={FileText} actions={<Badge variant="outline" className="h-9 border-[#5A92C9]/25 bg-[#5A92C9]/5 px-3 text-[#376F9F]"><ShieldCheck className="mr-2 h-4 w-4" />Permissions enforced by SharePoint</Badge>} />

      {documents.data?.status === "unconfigured" ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>SharePoint HR library is not configured</AlertTitle><AlertDescription>{documents.data.message}</AlertDescription></Alert> : null}
      {documents.data?.status === "degraded" ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>SharePoint documents are temporarily unavailable</AlertTitle><AlertDescription>{documents.data.message}</AlertDescription></Alert> : null}
      {documents.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Human Resources documents could not be loaded</AlertTitle><AlertDescription>{documents.error.message}</AlertDescription></Alert> : null}

      <Card className="border-0 shadow-soft">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search policies, forms, and employee resources" className="h-11 pl-10" /></label>
          <select value={category} onChange={event => setCategory(event.target.value)} className="h-11 min-w-52 rounded-md border border-input bg-white px-3 text-sm"><option value="all">All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <div className="flex rounded-lg border border-border bg-white p-1"><Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setView("grid")}><Grid2X2 className="mr-1.5 h-4 w-4" />Grid</Button><Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}><List className="mr-1.5 h-4 w-4" />List</Button></div>
        </CardContent>
      </Card>

      {documents.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-2xl" />)}</div> : filtered.length ? view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(item => <article key={item.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]"><DocumentIcon mimeType={item.mimeType} isFolder={item.isFolder} /></div><div className="min-w-0"><Badge variant="outline" className="max-w-full truncate border-[#D58240]/20 bg-[#D58240]/5 text-[10px] text-[#9A5727]">{item.category}</Badge><h2 className="mt-2 break-words font-bold leading-5">{item.name}</h2></div></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4"><div className="text-xs text-muted-foreground"><p>{item.isFolder ? "Folder" : formatBytes(item.size)}</p><p className="mt-1">{item.lastModifiedAt ? `Updated ${new Date(item.lastModifiedAt).toLocaleDateString()}` : "Update date unavailable"}</p></div><div className="flex items-center gap-1">{!item.isFolder ? <Button variant="ghost" size="icon" className="h-8 w-8 text-[#D58240]" aria-label={pinnedIds.has(item.id) ? `Unpin ${item.name}` : `Pin ${item.name}`} title={pinnedIds.has(item.id) ? "Remove from dashboard" : "Pin to dashboard"} onClick={() => togglePin(item.id)} disabled={pinDocument.isPending || removePin.isPending}>{pinnedIds.has(item.id) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}</Button> : null}<Button asChild size="sm" className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><a href={item.webUrl} target="_blank" rel="noreferrer">Open <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></div></div></article>)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"><div className="grid grid-cols-[1fr_160px_120px_150px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"><span>Name</span><span>Category</span><span>Size</span><span>Action</span></div>{filtered.map(item => <div key={item.id} className="grid grid-cols-[1fr_160px_120px_150px] items-center gap-4 border-b border-border/70 px-5 py-4 last:border-0"><div className="flex min-w-0 items-center gap-3"><div className="text-[#5A92C9]"><DocumentIcon mimeType={item.mimeType} isFolder={item.isFolder} /></div><span className="truncate text-sm font-semibold">{item.name}</span></div><span className="truncate text-sm text-muted-foreground">{item.category}</span><span className="text-sm text-muted-foreground">{item.isFolder ? "Folder" : formatBytes(item.size)}</span><div className="flex items-center gap-1">{!item.isFolder ? <Button variant="ghost" size="icon" className="h-8 w-8 text-[#D58240]" aria-label={pinnedIds.has(item.id) ? `Unpin ${item.name}` : `Pin ${item.name}`} onClick={() => togglePin(item.id)} disabled={pinDocument.isPending || removePin.isPending}>{pinnedIds.has(item.id) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}</Button> : null}<Button asChild variant="outline" size="sm"><a href={item.webUrl} target="_blank" rel="noreferrer">Open <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></div></div>)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white py-16 text-center"><FileText className="mx-auto h-9 w-9 text-[#5A92C9]" /><h2 className="mt-4 font-bold">No authorized documents in this view</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">SharePoint returns only document metadata that your Microsoft account is permitted to access. Try another search or ask Human Resources about library access.</p></div>
      )}

      <div className="flex items-start gap-3 rounded-2xl bg-[#5A92C9]/5 p-5 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5A92C9]" /><p><strong className="text-foreground">SharePoint remains the authorization boundary.</strong> Welfare Pride does not copy or recreate SharePoint access-control lists. Every document query uses the signed-in employee’s delegated Microsoft authorization, and open or download actions continue in SharePoint.</p></div>
    </div>
  );
}
