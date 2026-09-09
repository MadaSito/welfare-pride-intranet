import { PageHeader } from "@/components/PageHeader";
import { RestrictedAccessCard } from "@/components/RestrictedAccessCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BriefcaseBusiness, ShieldAlert } from "lucide-react";

export default function BusinessManagement() {
  const resource = trpc.portalAccess.businessManagement.useQuery();
  if (resource.isLoading) return <div className="space-y-5"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div>;
  if (resource.error?.data?.code === "FORBIDDEN") return <RestrictedAccessCard resourceKey="module:business-management" title="Business Management" />;
  if (resource.error) return <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Business Management is unavailable</AlertTitle><AlertDescription>{resource.error.message}</AlertDescription></Alert>;
  const page = resource.data;
  return <div className="space-y-7">
    <PageHeader eyebrow="Restricted workspace" title={page?.label || "Business Management"} description="This section is visible only to users assigned by an administrator through individual or Entra group access policies." icon={BriefcaseBusiness} />
    <Card className="border-0 shadow-soft"><CardContent className="p-7"><div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{page?.body || "An administrator has enabled Business Management but has not yet added workspace guidance or links."}</div></CardContent></Card>
  </div>;
}
