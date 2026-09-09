import { PageHeader } from "@/components/PageHeader";
import { RestrictedAccessCard } from "@/components/RestrictedAccessCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { FileText, ShieldAlert } from "lucide-react";
import { useRoute } from "wouter";

export default function CustomPortalPage() {
  const [, params] = useRoute("/pages/:slug");
  const slug = params?.slug || "";
  const page = trpc.portalAccess.customPage.useQuery({ slug }, { enabled: Boolean(slug) });
  if (page.isLoading) return <div className="space-y-5"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-60 rounded-2xl" /></div>;
  if (page.error?.data?.code === "FORBIDDEN") return <RestrictedAccessCard resourceKey={`page:${slug}`} title="this portal page" />;
  if (page.error) return <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Page is unavailable</AlertTitle><AlertDescription>{page.error.message}</AlertDescription></Alert>;
  return <div className="space-y-7">
    <PageHeader eyebrow="Restricted workspace" title={page.data?.label || "Portal page"} description={page.data?.navigationGroup || "Welfare Pride"} icon={FileText} />
    <Card className="border-0 shadow-soft"><CardContent className="p-7"><div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{page.data?.body || "This page has no published content yet."}</div></CardContent></Card>
  </div>;
}
