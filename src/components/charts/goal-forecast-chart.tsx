"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type { TimelinePoint } from "@/lib/goals";

function formatTick(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipContentProps<ValueType, NameType> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const balance = payload.find((p) => p.dataKey === "balance");
  if (!balance || typeof balance.value !== "number" || typeof label !== "number") return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">
        {new Date(label).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
      </p>
      <p className="font-semibold tabular-nums text-popover-foreground">
        {formatCurrency(balance.value, currency)}
      </p>
    </div>
  );
}

// A single goal's projected balance over time -- a straight-line growth at
// the current savings rate, bent around any one-time events (each renders
// as a sharp vertical step, not a smoothed slope, since goalTimelineSeries
// already injects an exact before/after point at the event's date). The
// dashed horizontal line marks the target; dashed vertical lines mark each
// event so a step is legible rather than just a kink in the line.
export function GoalForecastChart({
  data,
  targetAmount,
  currency,
  events,
}: {
  data: TimelinePoint[];
  targetAmount: number;
  currency: string;
  events: { label: string; occurs_on: string }[];
}) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickFormatter={formatTick}
            minTickGap={32}
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
          <ReferenceLine
            y={targetAmount}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            label={{
              value: "Target",
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          {events.map((event) => (
            <ReferenceLine
              key={`${event.label}-${event.occurs_on}`}
              x={new Date(`${event.occurs_on}T00:00:00`).getTime()}
              stroke="var(--border)"
              strokeDasharray="2 3"
              label={{
                // Rotated labels were getting clipped by the chart's own
                // bounds (no room for a 90°-tall label in a ~190px-tall
                // chart) -- horizontal and truncated fits reliably instead,
                // full text is still one hover away via the event list.
                value: event.label.length > 12 ? `${event.label.slice(0, 11)}…` : event.label,
                position: "top",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
          ))}
          <Line
            type="linear"
            dataKey="balance"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-3)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
