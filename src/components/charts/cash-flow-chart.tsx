"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type { CashFlowPoint } from "@/lib/trend";

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipContentProps<ValueType, NameType> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income");
  const spend = payload.find((p) => p.dataKey === "spend");

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      {income && typeof income.value === "number" && (
        <p className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 shrink-0 rounded-full bg-chart-3" />
          <span className="font-semibold tabular-nums text-popover-foreground">
            {formatCurrency(income.value, currency)}
          </span>
          <span className="text-muted-foreground">Income</span>
        </p>
      )}
      {spend && typeof spend.value === "number" && (
        <p className="mt-1 flex items-center gap-1.5">
          <span className="h-0.5 w-3 shrink-0 rounded-full bg-destructive" />
          <span className="font-semibold tabular-nums text-popover-foreground">
            {formatCurrency(spend.value, currency)}
          </span>
          <span className="text-muted-foreground">Spend</span>
        </p>
      )}
    </div>
  );
}

// Income and spend as two lines on the same time axis, deliberately never
// netted -- the point is seeing *when* each side lands (front-loaded right
// after payday? trickling out all period?), which a single net number
// already shown on the stat cards can't show. No compare overlay by design:
// doubling to 4 lines (income/spend x now/compare) stops being readable --
// see the equivalent tradeoff already made in SpendTrendChart.
export function CashFlowChart({
  data,
  currency = "MAD",
}: {
  data: CashFlowPoint[];
  currency?: string;
}) {
  const hasActivity = data.some((d) => d.income > 0 || d.spend > 0);

  if (!hasActivity) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity in this period yet.
      </p>
    );
  }

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
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
              content={(props) => <ChartTooltip {...props} currency={currency} />}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="var(--chart-3)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: "var(--chart-3)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="spend"
              stroke="var(--destructive)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: "var(--destructive)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-chart-3" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-destructive" /> Spend
        </span>
      </div>
    </div>
  );
}
