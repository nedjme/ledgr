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
