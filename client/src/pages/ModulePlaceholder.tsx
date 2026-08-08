import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type ModulePlaceholderProps = {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  capabilities: string[];
  source: string;
};

export function ModulePlaceholder({ title, eyebrow, description, icon, capabilities, source }: ModulePlaceholderProps) {
  return (
    <div className="space-y-7">
      <PageHeader eyebrow={eyebrow} title={title} description={description} icon={icon} />
      <Card className="overflow-hidden border-0 shadow-soft">
        <div className="h-1.5 bg-[#5A92C9]" />
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_0.7fr] lg:p-8">
          <div>
            <Badge className="border-0 bg-[#5A92C9]/10 text-[#376F9F] hover:bg-[#5A92C9]/10">Module workspace</Badge>
            <h2 className="mt-4 text-xl font-bold">Built around secure enterprise boundaries</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This workspace is connected to the portal shell and is being wired to its typed server contract. It will show a clear setup state until an administrator configures {source}.
            </p>
            <div className="mt-6 space-y-3">
              {capabilities.map(capability => (
                <div key={capability} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5A92C9]" aria-hidden="true" />
                  <span>{capability}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#F3F7FB] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D58240]">Data source</p>
            <p className="mt-3 text-lg font-bold">{source}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No sample employee, document, event, or backup records are fabricated. Real records appear after a successful authorized connection.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#376F9F]">
              Configuration status will appear here <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
