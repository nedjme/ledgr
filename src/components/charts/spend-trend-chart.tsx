"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type { TrendPoint } from "@/lib/trend";

export type SpendTrendPoint = TrendPoint & { compareValue?: number | null };

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  compareLabel,
}: TooltipContentProps<ValueType, NameType> & { currency: string; compareLabel?: string }) {
  if (!active || !payload?.length) return null;
  const current = payload.find((p) => p.dataKey === "value");
  const compare = payload.find((p) => p.dataKey === "compareValue");

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      {current && typeof current.value === "number" && (
        <p className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 shrink-0 rounded-full bg-chart-1" />
          <span className="font-semibold tabular-nums text-popover-foreground">
            {formatCurrency(current.value, currency)}
          </span>
        </p>
      )}
      {compare && typeof compare.value === "number" && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-0.5 w-3 shrink-0 rounded-full border-t-2 border-dashed border-muted-foreground" />
          <span className="tabular-nums">{formatCurrency(compare.value, currency)}</span>
          {compareLabel && <span>{compareLabel}</span>}
        </p>
      )}
    </div>
  );
}

// Spend per bucket (day/week/month, picked by `spendTrendSeries` to match
// the period's span) as a line -- optionally overlaid with the comparison
// period's own series (same bucket count, aligned by index rather than
// calendar date, since "day 12 of this month" vs. "day 12 of last month" is
// the comparison that matters here, not the calendar dates lining up).
export function SpendTrendChart({
  data,
  currency = "MAD",
  compareLabel,
}: {
  data: SpendTrendPoint[];
  currency?: string;
  compareLabel?: string;
}) {
  const hasSpend = data.some((d) => d.value > 0);
  const hasCompare = data.some((d) => d.compareValue != null);

  if (!hasSpend) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No spending in this period yet.
      </p>
    );
  }

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="spendTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={40}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(v: number) => formatCompactNumber(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={(props) => (
                <ChartTooltip {...props} currency={currency} compareLabel={compareLabel} />
              )}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#spendTrendFill)"
              isAnimationActive={false}
            />
            {hasCompare && (
              <Line
                type="monotone"
                dataKey="compareValue"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hasCompare && (
        <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-chart-1" /> This period
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full border-t-2 border-dashed border-muted-foreground" />
            {compareLabel ?? "Comparison period"}
          </span>
        </div>
      )}
    </div>
  );
}
