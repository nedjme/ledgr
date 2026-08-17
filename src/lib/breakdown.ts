export type BreakdownDatum = {
  id: string | null;
  name: string;
  value: number;
  icon?: string | null;
  color?: string | null;
  /**
   * Precomputed server-side rather than a hrefFor(row) callback prop --
   * functions can't cross the server/client component boundary, only
   * serializable data.
   */
  href?: string;
  // This category's value for the comparison period, when a comparison is
  // active -- lets the chart show a per-row delta. Summed into "Other"
  // just like `value` when rows get capped by toBreakdown, so the two
  // stay on the same footing.
  previousValue?: number | null;
};

// "Other" (id: null) never counts toward maxSlots as one of the real
// entries -- capping at 5 means "5 real categories, plus Other if there's
// more", not "4 categories once Other is added".
export function toBreakdown(rows: BreakdownDatum[], maxSlots = 5): BreakdownDatum[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= maxSlots) return sorted;

  const head = sorted.slice(0, maxSlots);
  const rest = sorted.slice(maxSlots);
  const otherTotal = rest.reduce((sum, row) => sum + row.value, 0);
  const otherPreviousTotal = rest.some((row) => row.previousValue != null)
    ? rest.reduce((sum, row) => sum + (row.previousValue ?? 0), 0)
    : null;
  return [...head, { id: null, name: "Other", value: otherTotal, previousValue: otherPreviousTotal }];
}
