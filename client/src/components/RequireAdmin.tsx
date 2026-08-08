import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-64 animate-pulse rounded-2xl bg-muted/60" aria-label="Checking administrator access" />;
  if (user?.role !== "admin") {
    return <Card className="mx-auto mt-12 max-w-xl border-0 shadow-soft"><CardContent className="py-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><ShieldX className="h-7 w-7" /></div><h1 className="mt-5 text-2xl font-bold">Administrator access required</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">This Welfare Pride administration page is available only to authorized administrators. The server also enforces the same role requirement for every operation.</p><Button asChild className="mt-6 bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90"><Link href="/">Return to dashboard</Link></Button></CardContent></Card>;
  }
  return <>{children}</>;
}
