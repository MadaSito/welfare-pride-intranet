import { useState } from "react";
import { BrainCircuit, Settings, ShieldCheck } from "lucide-react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";

type Source = { id: string; title: string; url: string; type: string };
type ChatEntry = Message & { sources?: Source[] };

export function WelfarePrideAssistant({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const status = trpc.assistant.status.useQuery(undefined, { enabled: open, retry: false });
  const ask = trpc.assistant.ask.useMutation();

  const send = (question: string) => {
    const history = messages.slice(-6).map(({ role, content }) => ({ role: role === "system" ? "assistant" as const : role, content }));
    setMessages(current => [...current, { role: "user", content: question }]);
    ask.mutate({ question, history }, {
      onSuccess: result => setMessages(current => [...current, { role: "assistant", content: result.answer, sources: result.sources }]),
      onError: error => setMessages(current => [...current, { role: "assistant", content: `I could not complete that request. ${error.message}` }]),
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-[#5A92C9]/25 bg-white text-[#376F9F]">
          <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">Ask Welfare Pride</span>
          <span className="sr-only lg:hidden">Open Welfare Pride assistant</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-5 text-left">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]"><BrainCircuit className="h-5 w-5" /></div><div><SheetTitle>Ask Welfare Pride</SheetTitle><SheetDescription>Answers grounded in approved company content and HR resources you may access.</SheetDescription></div></div>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {status.isLoading ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Checking assistant configuration…</div> : null}
          {status.error ? <Alert variant="destructive"><AlertTitle>Assistant status unavailable</AlertTitle><AlertDescription>{status.error.message}</AlertDescription></Alert> : null}
          {status.data && !status.data.configured ? <Alert className="border-[#D58240]/25 bg-[#D58240]/5"><Settings className="h-4 w-4 text-[#D58240]" /><AlertTitle>AI provider setup required</AlertTitle><AlertDescription>{isAdmin ? "Open Integration Settings and configure an OpenAI-compatible provider, model, and optional API key." : "A Welfare Pride administrator must configure the assistant provider before it can answer questions."}{isAdmin ? <Button variant="link" className="mt-2 h-auto p-0 text-[#9A5727]" onClick={() => window.location.assign("/admin/integrations")}>Open Integration Settings</Button> : null}</AlertDescription></Alert> : null}
          {status.data?.configured ? <AIChatBox messages={messages} messageSources={messages.map(message => message.sources)} onSendMessage={send} isLoading={ask.isPending} height="100%" className="min-h-0 flex-1 rounded-2xl border-border shadow-none" placeholder="Ask about a policy, HR resource, or company update…" emptyStateMessage={`Ask a question using ${status.data.providerName}. Answers include source links.`} suggestedPrompts={["Where can I find employee policies?", "What are the latest company announcements?", "Summarize the information about time off in the HR resources."]} /> : null}
        </div>
        <div className="flex items-start gap-2 border-t border-border bg-muted/30 px-5 py-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5A92C9]" /><p>SharePoint access is checked for every HR retrieval. Verify important policy details in the linked source before acting.</p></div>
      </SheetContent>
    </Sheet>
  );
}
