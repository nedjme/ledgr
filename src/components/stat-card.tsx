import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";

export function StatCard({
  label,
  value,
  tone,
  trend,
  comparePct,
  compareLabel,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  trend?: number[];
  // Percentage change vs. a comparison period. Direction is judged against
  // `tone`: for a "positive" stat (income) going up is good; for a
  // "negative" stat (spend) going up is bad. Omit tone and an increase is
  // shown neutrally.
  comparePct?: number | null;
  compareLabel?: string;
}) {
  const toneColor =
    tone === "positive"
      ? "var(--chart-3)"
      : tone === "negative"
        ? "var(--destructive)"
        : "var(--primary)";

  const increaseIsGood = tone === "positive";
  const isGoodChange =
    tone != null && comparePct != null && comparePct !== 0 && (increaseIsGood ? comparePct > 0 : comparePct < 0);
  const isBadChange =
    tone != null && comparePct != null && comparePct !== 0 && (increaseIsGood ? comparePct < 0 : comparePct > 0);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 truncate text-2xl font-semibold tabular-nums",
              tone === "positive" && "text-chart-3",
              tone === "negative" && "text-destructive",
            )}
          >
            {value}
          </p>
          {comparePct != null && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium tabular-nums",
                isGoodChange && "text-chart-3",
                isBadChange && "text-destructive",
                !isGoodChange && !isBadChange && "text-muted-foreground",
              )}
            >
              {comparePct !== 0 &&
                (comparePct > 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                ))}
              {comparePct === 0 ? "No change" : `${Math.abs(Math.round(comparePct))}%`}
              {compareLabel && <span className="text-muted-foreground">{compareLabel}</span>}
            </p>
          )}
        </div>
        {trend && <Sparkline data={trend} color={toneColor} />}
      </CardContent>
    </Card>
  );
}
