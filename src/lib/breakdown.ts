export type BreakdownDatum = { name: string; value: number };

export function toBreakdown(
  rows: { name: string; value: number }[],
  maxSlots = 5,
): BreakdownDatum[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= maxSlots) return sorted;

  const head = sorted.slice(0, maxSlots - 1);
  const other = sorted.slice(maxSlots - 1);
  const otherTotal = other.reduce((sum, row) => sum + row.value, 0);
  return [...head, { name: "Other", value: otherTotal }];
}
