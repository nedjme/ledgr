import { formatCurrency } from "@/lib/format";
import type { BreakdownDatum } from "@/lib/breakdown";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const OTHER_COLOR = "var(--muted-foreground)";

export function BreakdownChart({
  data,
  currency = "MAD",
}: {
  data: BreakdownDatum[];
  currency?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No spending in this period yet.
      </p>
    );
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, row) => sum + row.value, 0);
  const max = sorted[0].value;

  return (
    <div className="space-y-4">
      {sorted.map((row, index) => {
        const color = row.name === "Other" ? OTHER_COLOR : SERIES_COLORS[index % SERIES_COLORS.length];
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const width = max > 0 ? Math.max((row.value / max) * 100, 3) : 0;

        return (
          <div key={row.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCurrency(row.value, currency)}{" "}
                <span className="text-xs">({share}%)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
