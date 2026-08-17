import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { categoryColor, OTHER_COLOR } from "@/lib/category-color";
import { categoryIconComponent } from "@/lib/category-icons";
import type { BreakdownDatum } from "@/lib/breakdown";
import { cn } from "@/lib/utils";

export function BreakdownChart({
  data,
  currency = "MAD",
  onOtherClick,
}: {
  data: BreakdownDatum[];
  currency?: string;
  /** Called when the "Other" row is clicked, e.g. to open a full breakdown. */
  onOtherClick?: () => void;
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

  return (
    <div className="space-y-4">
      {sorted.map((row) => {
        const color = row.id === null ? OTHER_COLOR : categoryColor(row.id, row.color);
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        // Bar width is the same share% printed next to it, not scaled
        // against the largest row -- those are two different scales, and
        // showing both at once made a bar's length not match its own label.
        const width = total > 0 ? Math.max((row.value / total) * 100, 3) : 0;
        const href = row.id !== null ? row.href : undefined;
        const clickable = href != null || (row.id === null && onOtherClick != null);
        const Icon = categoryIconComponent(row.icon);
        // Categories here are always spend, so an increase is bad
        // (red)/decrease is good (green) -- same convention as the mini
        // report, no need for a tone prop.
        const comparePct =
          row.previousValue != null && row.previousValue > 0
            ? ((row.value - row.previousValue) / row.previousValue) * 100
            : null;

        const rowContent = (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                {Icon ? (
                  <Icon className="size-3.5 shrink-0" style={{ color }} />
                ) : (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="truncate">{row.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCurrency(row.value, currency)}{" "}
                <span className="text-xs">({share}%)</span>
                {comparePct != null && (
                  <span
                    className={cn(
                      "ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                      comparePct > 0 ? "text-destructive" : "text-chart-3",
                    )}
                  >
                    {comparePct !== 0 &&
                      (comparePct > 0 ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      ))}
                    {comparePct === 0 ? "±0%" : `${Math.abs(Math.round(comparePct))}%`}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
          </>
        );

        // Links/buttons are inline by default; with block-level children
        // (the label row + progress bar) stacked inside, an inline box
        // fragments its background/radius per line instead of drawing one
        // rectangle -- `block` is what keeps the hover highlight as a
        // single shape instead of a stray sliver above the row. `w-full` is
        // explicit (not left to block's implicit fill) so a <button> and a
        // <Link> resolve to the exact same width instead of drifting apart.
        const rowClassName = cn(
          "block w-full rounded-lg text-left",
          clickable && "-mx-0.5 px-2 py-1.5 transition-colors hover:bg-muted/60",
        );

        if (href) {
          return (
            <Link key={row.id ?? "other"} href={href} className={rowClassName}>
              {rowContent}
            </Link>
          );
        }

        if (row.id === null && onOtherClick) {
          return (
            <button key="other" type="button" onClick={onOtherClick} className={rowClassName}>
              {rowContent}
            </button>
          );
        }

        return (
          <div key={row.id ?? "other"} className={rowClassName}>
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}
