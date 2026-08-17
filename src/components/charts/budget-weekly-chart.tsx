"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type { WeekBucket } from "@/lib/budgets";

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  color,
}: TooltipContentProps<ValueType, NameType> & { currency: string; color: string }) {
  if (!active || !payload?.length) return null;
  const amount = payload[0];
  if (typeof amount.value !== "number") return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      <p className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold tabular-nums text-popover-foreground">
          {formatCurrency(amount.value, currency)}
        </span>
      </p>
    </div>
  );
}

// A monthly budget's spend broken down by calendar week -- the "detailed
// repartition" view, one bar per week, with a dashed reference line at
// the even-pace-per-week amount (budget amount / number of weeks) so a
// front-loaded or back-loaded month is visible at a glance rather than
// just the month-to-date total the card itself already shows.
export function BudgetWeeklyChart({
  data,
  budgetAmount,
  currency,
  color = "var(--primary)",
}: {
  data: WeekBucket[];
  budgetAmount: number;
  currency: string;
  color?: string;
}) {
  const weeklyAverage = budgetAmount / data.length;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={40}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
          />
          <ReferenceLine
            y={weeklyAverage}
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(props) => <ChartTooltip {...props} currency={currency} color={color} />}
          />
          <Bar dataKey="amount" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Dashed line: even pace ({formatCurrency(weeklyAverage, currency)}/week)
      </p>
    </div>
  );
}
