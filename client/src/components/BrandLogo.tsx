import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "icon" | "wordmark";
  className?: string;
};

export function BrandLogo({ variant = "full", className }: BrandLogoProps) {
  const source = variant === "icon" ? BRAND.icon : variant === "wordmark" ? BRAND.wordmark : BRAND.logo;
  return (
    <img
      src={source}
      alt={variant === "icon" ? "Welfare Pride emblem" : "Welfare Pride"}
      className={cn("block object-contain", className)}
    />
  );
}
