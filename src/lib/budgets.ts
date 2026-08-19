import { startOfWeek, endOfWeek, addWeeks, formatISO } from "date-fns";
import { periodRange, periodLabel } from "@/lib/period";
import { topCategoryId, type CategoryNode } from "@/lib/category-hierarchy";

export function budgetMonthRange() {
  return periodRange("month", new Date());
}

export function budgetMonthLabel() {
  return periodLabel("month", new Date());
}

// An Overall budget is a cap on total spend in a currency -- category
// budgets underneath it should never collectively promise more than that
// cap allows. Works in both directions: saving a category budget checks it
// against an existing Overall (if any), saving the Overall itself checks it
// against the category budgets already under it. `otherBudgets` is every
// other budget for the same owner (i.e. excluding whichever one is being
// saved) -- currency comparison is case-insensitive since the currency
// field is free text.
export function budgetExceedsOverallCap(
  categoryId: string | null,
  amount: number,
  currency: string,
  otherBudgets: { category_id: string | null; currency: string; amount: number }[],
): boolean {
  const sameCurrency = otherBudgets.filter((b) => b.currency.toUpperCase() === currency.toUpperCase());
  const categoryTotal = sameCurrency
    .filter((b) => b.category_id !== null)
    .reduce((sum, b) => sum + b.amount, 0);

  if (categoryId === null) {
    return categoryTotal > amount;
  }

  const overall = sameCurrency.find((b) => b.category_id === null);
  if (!overall) return false;
  return categoryTotal + amount > overall.amount;
}

// Sums spend in a date range against a budget's scope (a single top-level
// category, rolling up its subcategories, or every category for an
// "overall" budget) -- computed live off transactions rather than a
// stored per-period row, so editing a budget's amount doesn't need to
// touch any history. Also the building block for the weekly breakdown
// below: same filter, just called once per week instead of once for the
// whole month.
//
// `ownerId` matters now that a budget can be visible to (but only edited
// by) other household members -- the transaction set passed in may span
// the whole household, but a budget is still one person's personal limit,
// so it only ever counts that person's own spend.
export function budgetSpent<T extends CategoryNode>(
  ownerId: string,
  categoryId: string | null,
  currency: string,
  transactions: { user_id: string; amount: number; currency: string; category_id: string | null; occurred_at: string }[],
  categoryById: Map<string, T>,
  range: { start: string; end: string },
): number {
  return transactions
    .filter(
      (t) =>
        t.user_id === ownerId &&
        t.amount < 0 &&
        t.currency === currency &&
        t.occurred_at >= range.start &&
        t.occurred_at <= range.end,
    )
    .filter((t) => {
      if (!categoryId) return true;
      // Exact match covers a budget whose category was later nested under a
      // new parent (categories.parent_id can change after a budget is
      // created) -- topCategoryId(t) would then roll up to the *new*
      // parent, never matching the budget's still-stored subcategory id, so
      // spend against it would silently go to zero without this.
      if (t.category_id === categoryId) return true;
      const category = t.category_id ? categoryById.get(t.category_id) : null;
      return topCategoryId(category, categoryById) === categoryId;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

export type WeekBucket = { start: string; end: string; label: string; amount: number };

// Splits a budget's month into calendar weeks (clipped to the month's own
// bounds at each end, so the first/last bucket isn't padded with days
// outside the month) and sums this budget's spend within each -- the
// "detailed repartition by week" view for an otherwise monthly budget.
export function weeklyBudgetBreakdown<T extends CategoryNode>(
  ownerId: string,
  categoryId: string | null,
  currency: string,
  transactions: { user_id: string; amount: number; currency: string; category_id: string | null; occurred_at: string }[],
  categoryById: Map<string, T>,
  monthRange: { start: string; end: string },
): WeekBucket[] {
  const monthStart = new Date(`${monthRange.start}T00:00:00`);
  const monthEnd = new Date(`${monthRange.end}T00:00:00`);

  const weeks: { start: string; end: string; label: string }[] = [];
  let cursor = startOfWeek(monthStart);
  let weekNumber = 1;
  while (cursor <= monthEnd) {
    const weekStart = cursor < monthStart ? monthStart : cursor;
    const weekEndRaw = endOfWeek(cursor);
    const weekEnd = weekEndRaw > monthEnd ? monthEnd : weekEndRaw;
    weeks.push({
      start: formatISO(weekStart, { representation: "date" }),
      end: formatISO(weekEnd, { representation: "date" }),
      label: `Week ${weekNumber}`,
    });
    cursor = addWeeks(cursor, 1);
    weekNumber++;
  }

  return weeks.map((week) => ({
    ...week,
    amount: budgetSpent(ownerId, categoryId, currency, transactions, categoryById, {
      start: week.start,
      end: week.end,
    }),
  }));
}
