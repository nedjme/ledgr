import { Tag, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { categoryColor } from "@/lib/category-color";
import { categoryIconComponent } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export type CategoryReportGroup = {
  currency: string;
  total: number;
  count: number;
  trendVsPreviousPct: number | null;
};

export function CategoryMiniReport({
  name,
  icon,
  categoryId,
  color,
  groups,
  compareLabel = "vs previous period",
}: {
  name: string;
  icon: string | null;
  categoryId: string;
  color: string | null;
  groups: CategoryReportGroup[];
  compareLabel?: string;
}) {
  if (groups.length === 0) return null;

  const resolvedColor = categoryColor(categoryId, color);
  const Icon = categoryIconComponent(icon) ?? Tag;

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `color-mix(in oklab, ${resolvedColor} 15%, transparent)`,
            }}
          >
            {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable lookup from a static registry, not a component defined during render */}
            <Icon className="size-5" style={{ color: resolvedColor }} />
          </span>
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
        </div>

        <div className="space-y-4">
          {groups.map((group) => {
            const average = group.count > 0 ? group.total / group.count : 0;
            return (
              <div
                key={group.currency}
                className={cn(
                  "grid grid-cols-2 gap-4 sm:grid-cols-4",
                  groups.length > 1 && "rounded-xl bg-muted/60 p-4",
                )}
              >
                {groups.length > 1 && (
                  <p className="col-span-2 -mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-4">
                    {group.currency}
                  </p>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Total spent</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {formatCurrency(group.total, group.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{group.count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {formatCurrency(average, group.currency)}
                  </p>
                </div>
                {group.trendVsPreviousPct !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground capitalize">{compareLabel}</p>
                    <p
                      className={cn(
                        "mt-1 flex items-center gap-1 text-xl font-bold tabular-nums",
                        group.trendVsPreviousPct > 0 ? "text-destructive" : "text-chart-3",
                      )}
                    >
                      {group.trendVsPreviousPct === 0 ? (
                        "—"
                      ) : (
                        <>
                          {group.trendVsPreviousPct > 0 ? (
                            <TrendingUp className="size-4" />
                          ) : (
                            <TrendingDown className="size-4" />
                          )}
                          {Math.abs(Math.round(group.trendVsPreviousPct))}%
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
