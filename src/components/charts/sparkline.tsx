"use client";

import { Bar, BarChart, ResponsiveContainer } from "recharts";

export function Sparkline({
  data,
  color = "var(--primary)",
}: {
  data: number[];
  color?: string;
}) {
  if (data.length === 0 || data.every((v) => v === 0)) return null;

  const chartData = data.map((value, i) => ({ i, value }));

  return (
    <div className="h-8 w-16 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap={2}>
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
