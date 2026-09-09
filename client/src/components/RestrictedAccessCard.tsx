import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, LockKeyhole, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function RestrictedAccessCard({ resourceKey, title }: { resourceKey: string; title: string }) {
  const [, setLocation] = useLocation();
  const [note, setNote] = useState("");
  const requestAccess = trpc.portalAccess.requestAccess.useMutation({
    onSuccess: result => {
      toast.success(result.created ? "Your access request was sent to Welfare Pride administrators." : "Your access request is already pending review.");
      setNote("");
    },
    onError: error => toast.error(error.message),
  });

  return <div className="mx-auto flex min-h-[52vh] max-w-2xl items-center py-8">
    <Card className="w-full overflow-hidden border-[#D58240]/25 shadow-soft">
      <CardHeader className="border-b border-[#D58240]/18 bg-gradient-to-r from-[#D58240]/10 to-white p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D58240] text-white"><LockKeyhole className="h-6 w-6" /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#9A5727]">Restricted resource</p>
        <CardTitle className="mt-2 text-2xl">You need access to {title}</CardTitle>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">This page is limited to employees assigned by a Welfare Pride administrator or an authorized Microsoft Entra group. Its contents remain unavailable until access is approved.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-6 sm:p-8">
        <div className="space-y-2"><label htmlFor="access-request-note" className="text-sm font-semibold">Optional message</label><Textarea id="access-request-note" value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder="Briefly explain why you need access…" className="min-h-24" /><p className="text-xs text-muted-foreground">Your name, request time, and optional message are shared with portal administrators for review.</p></div>
        <div className="flex flex-wrap gap-3"><Button className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" onClick={() => requestAccess.mutate({ resourceKey, note: note.trim() || undefined })} disabled={requestAccess.isPending}>{requestAccess.isPending ? "Sending request…" : <><Send className="mr-2 h-4 w-4" />Request access</>}</Button><Button variant="outline" onClick={() => setLocation("/")}><ArrowLeft className="mr-2 h-4 w-4" />Return to dashboard</Button></div>
      </CardContent>
    </Card>
  </div>;
}
