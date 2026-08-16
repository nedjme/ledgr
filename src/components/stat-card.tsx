import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";

export function StatCard({
  label,
  value,
  tone,
  trend,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  trend?: number[];
}) {
  const toneColor =
    tone === "positive"
      ? "var(--chart-3)"
      : tone === "negative"
        ? "var(--destructive)"
        : "var(--primary)";

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
        </div>
        {trend && <Sparkline data={trend} color={toneColor} />}
      </CardContent>
    </Card>
  );
}
