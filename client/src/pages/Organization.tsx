import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { DirectoryNode } from "@shared/domain";
import { LocateFixed, Mail, MapPin, Minus, Network, Phone, Plus, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "WP";
}

function OrgNode({ node, childrenMap, query, onSelect }: { node: DirectoryNode; childrenMap: Map<string, DirectoryNode[]>; query: string; onSelect: (node: DirectoryNode) => void }) {
  const children = childrenMap.get(node.id) || [];
  const highlighted = query && `${node.displayName} ${node.jobTitle || ""} ${node.department || ""}`.toLowerCase().includes(query.toLowerCase());
  return (
    <li className="relative flex flex-col items-center px-4 pt-8 before:absolute before:left-1/2 before:top-0 before:h-8 before:w-px before:bg-[#5A92C9]/35 first:before:hidden">
      <button onClick={() => onSelect(node)} className={`relative z-10 w-56 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A92C9] ${highlighted ? "border-[#D58240] ring-4 ring-[#D58240]/12" : "border-border"}`}>
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border-2 border-[#5A92C9]/15"><AvatarImage src={node.photoUrl || undefined} alt="" /><AvatarFallback className="bg-[#5A92C9]/10 text-xs font-bold text-[#376F9F]">{initials(node.displayName)}</AvatarFallback></Avatar>
          <div className="min-w-0"><p className="truncate text-sm font-bold">{node.displayName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{node.jobTitle || "Welfare Pride employee"}</p></div>
        </div>
        {node.department ? <Badge variant="outline" className="mt-3 max-w-full truncate border-[#5A92C9]/20 bg-[#5A92C9]/5 text-[10px] text-[#376F9F]">{node.department}</Badge> : null}
      </button>
      {children.length ? (
        <ul className="relative flex items-start justify-center pt-8 before:absolute before:left-[calc(7rem)] before:right-[calc(7rem)] before:top-4 before:h-px before:bg-[#5A92C9]/35">
          {children.map(child => <OrgNode key={child.id} node={child} childrenMap={childrenMap} query={query} onSelect={onSelect} />)}
        </ul>
      ) : null}
    </li>
  );
}

export default function Organization() {
  const organization = trpc.profiles.organization.useQuery();
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(0.85);
  const [offset, setOffset] = useState({ x: 40, y: 20 });
  const [selected, setSelected] = useState<DirectoryNode | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const { roots, childrenMap } = useMemo(() => {
    const items = organization.data?.items || [];
    const ids = new Set(items.map(item => item.id));
    const map = new Map<string, DirectoryNode[]>();
    for (const item of items) {
      if (item.managerId && ids.has(item.managerId)) {
        const existing = map.get(item.managerId) || [];
        existing.push(item);
        map.set(item.managerId, existing);
      }
    }
    Array.from(map.values()).forEach((children: DirectoryNode[]) => {
      children.sort((a: DirectoryNode, b: DirectoryNode) => a.displayName.localeCompare(b.displayName));
    });
    return { roots: items.filter(item => !item.managerId || !ids.has(item.managerId)).sort((a, b) => a.displayName.localeCompare(b.displayName)), childrenMap: map };
  }, [organization.data?.items]);

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="See how we connect" title="Organization Chart" description="Explore Welfare Pride reporting relationships, find colleagues, and open employee details without leaving the hierarchy." icon={Network} />
      {organization.data?.status === "unconfigured" ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>Live Microsoft Graph hierarchy is not configured</AlertTitle><AlertDescription>{organization.data.message}</AlertDescription></Alert> : null}
      {organization.data?.status === "degraded" ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><ShieldAlert className="h-4 w-4 text-[#D58240]" /><AlertTitle>Showing the last synchronized hierarchy</AlertTitle><AlertDescription>{organization.data.message}</AlertDescription></Alert> : null}
      {organization.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Organization chart could not be loaded</AlertTitle><AlertDescription>{organization.error.message}</AlertDescription></Alert> : null}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Highlight a name, title, or department" className="h-10 pl-10" /></label>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(0.45, Number((value - 0.1).toFixed(2))))}><Minus className="h-4 w-4" /></Button>
          <span className="min-w-14 text-center text-xs font-semibold text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(1.5, Number((value + 0.1).toFixed(2))))}><Plus className="h-4 w-4" /></Button>
          <Button variant="outline" className="gap-2" onClick={() => { setZoom(0.85); setOffset({ x: 40, y: 20 }); }}><RotateCcw className="h-4 w-4" />Reset</Button>
        </div>
      </div>

      {organization.isLoading ? <Skeleton className="h-[620px] rounded-2xl" /> : roots.length ? (
        <div
          className={`relative h-[650px] overflow-hidden rounded-2xl border border-border bg-[#F8FBFD] shadow-inner ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={event => { setDragging(true); dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (!dragging) return; setOffset({ x: dragStart.current.offsetX + event.clientX - dragStart.current.x, y: dragStart.current.offsetY + event.clientY - dragStart.current.y }); }}
          onPointerUp={event => { setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => setDragging(false)}
        >
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-border bg-white/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur"><LocateFixed className="mr-1.5 inline h-3.5 w-3.5 text-[#5A92C9]" />Drag the canvas to pan</div>
          <div className="absolute left-0 top-0 min-w-max origin-top-left select-none p-10" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
            <ul className="flex items-start justify-center">{roots.map(root => <OrgNode key={root.id} node={root} childrenMap={childrenMap} query={query} onSelect={setSelected} />)}</ul>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white px-6 py-20 text-center"><Network className="mx-auto h-9 w-9 text-[#5A92C9]" /><h2 className="mt-4 font-bold">The organization chart is ready for directory data</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">An administrator can connect Microsoft Entra ID and run a directory synchronization. The hierarchy will render from manager and direct-report relationships.</p></div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected ? <><DialogHeader><div className="flex items-center gap-4"><Avatar className="h-16 w-16 border-2 border-[#5A92C9]/15"><AvatarImage src={selected.photoUrl || undefined} alt="" /><AvatarFallback className="bg-[#5A92C9]/10 font-bold text-[#376F9F]">{initials(selected.displayName)}</AvatarFallback></Avatar><div className="min-w-0"><DialogTitle className="truncate">{selected.displayName}</DialogTitle><DialogDescription className="mt-1">{selected.jobTitle || "Welfare Pride employee"}</DialogDescription></div></div></DialogHeader><div className="space-y-3 pt-2 text-sm"><p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-[#5A92C9]" /><span className="break-all">{selected.email || "Email not provided"}</span></p><p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-[#5A92C9]" />{selected.phone || "Phone not provided"}</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[#5A92C9]" />{selected.officeLocation || "Location not provided"}</p>{selected.department ? <Badge variant="outline" className="border-[#D58240]/25 bg-[#D58240]/5 text-[#9A5727]">{selected.department}</Badge> : null}</div></> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
