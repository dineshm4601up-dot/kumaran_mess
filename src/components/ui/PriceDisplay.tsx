import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

type PriceDisplaySize = "sm" | "md" | "lg";

const sizeClasses: Record<PriceDisplaySize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

export function PriceDisplay({
  amount,
  compareAtAmount,
  size = "md",
  className,
}: {
  amount: number;
  compareAtAmount?: number;
  size?: PriceDisplaySize;
  className?: string;
}) {
  const hasDiscount = typeof compareAtAmount === "number" && compareAtAmount > amount;

  return (
    <span className={cn("inline-flex items-baseline gap-2 font-semibold text-foreground", sizeClasses[size], className)}>
      {formatCurrency(amount)}
      {hasDiscount && (
        <span className="text-muted-foreground text-sm font-normal line-through">
          {formatCurrency(compareAtAmount)}
        </span>
      )}
    </span>
  );
}
