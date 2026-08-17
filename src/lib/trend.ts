import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  getYear,
  startOfWeek,
} from "date-fns";

export function dailySpendTrend(
  rows: { occurred_at: string; amount: number }[],
  start: string,
  end: string,
) {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.amount >= 0) continue;
    byDay.set(row.occurred_at, (byDay.get(row.occurred_at) ?? 0) + Math.abs(row.amount));
  }

  const trend: number[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    trend.push(byDay.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  return trend;
}

export type TrendPoint = { label: string; value: number };

type Granularity = "day" | "week" | "month";

// A day-by-day line is fine for a week or month (≤ ~30 points) but turns
// into unreadable noise over a year -- bucket coarser as the span widens so
// the chart always renders a manageable, roughly comparable point count.
function granularityFor(days: number): Granularity {
  if (days <= 40) return "day";
  if (days <= 150) return "week";
  return "month";
}

function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === "day") return format(date, "yyyy-MM-dd");
  if (granularity === "week") return format(startOfWeek(date), "yyyy-MM-dd");
  return format(date, "yyyy-MM");
}

function bucketLabel(date: Date, granularity: Granularity, spansMultipleYears: boolean): string {
  if (granularity === "day") return format(date, "MMM d");
  if (granularity === "week") return format(startOfWeek(date), "MMM d");
  return spansMultipleYears ? format(date, "MMM ''yy") : format(date, "MMM");
}

// Buckets spend into an adaptive day/week/month grid for a line chart --
// unlike `dailySpendTrend` (always daily, sized for an 8px-tall sparkline
// where density doesn't matter), this is read at full size with axis
// labels, so bucket width has to track the span.
export function spendTrendSeries(
  rows: { occurred_at: string; amount: number }[],
  start: string,
  end: string,
): TrendPoint[] {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const days = differenceInCalendarDays(endDate, startDate);
  const granularity = granularityFor(days);
  const spansMultipleYears = getYear(startDate) !== getYear(endDate);

  const buckets =
    granularity === "day"
      ? eachDayOfInterval({ start: startDate, end: endDate })
      : granularity === "week"
        ? eachWeekOfInterval({ start: startDate, end: endDate })
        : eachMonthOfInterval({ start: startDate, end: endDate });

  const byKey = new Map<string, number>();
  for (const row of rows) {
    if (row.amount >= 0) continue;
    const key = bucketKey(new Date(`${row.occurred_at}T00:00:00`), granularity);
    byKey.set(key, (byKey.get(key) ?? 0) + Math.abs(row.amount));
  }

  return buckets.map((date) => ({
    label: bucketLabel(date, granularity, spansMultipleYears),
    value: byKey.get(bucketKey(date, granularity)) ?? 0,
  }));
}
