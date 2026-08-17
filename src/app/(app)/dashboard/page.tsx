import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, periodRange } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { dailySpendTrend } from "@/lib/trend";
import { groupByCurrency } from "@/lib/group-by-currency";
import { accountBalances, sumByCurrency } from "@/lib/balance";
import { BalanceCard } from "@/components/balance-summary";
import { PeriodToggle } from "@/components/period-toggle";
import { StatCard } from "@/components/stat-card";
import { HeroSummaryCard } from "@/components/hero-summary-card";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { TransactionList } from "@/components/transaction-list";
import { CategorySpendCard } from "@/components/category-spend-card";
import { toBreakdown, type BreakdownDatum } from "@/lib/breakdown";
import { topCategoryId } from "@/lib/category-hierarchy";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    anchor?: string;
    start?: string;
    end?: string;
    compare?: string;
  }>;
}) {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const params = await searchParams;
  const resolved = resolvePeriod(params);
  // A custom range with no end picked yet still needs *something* to query
  // -- falls back to the current month rather than fetching nothing.
  const { start, end } = resolved.range ?? periodRange("month", resolved.anchor);

  const supabase = await createClient();

  const [
    { data: accounts },
    { data: categories },
    { data: transactions },
    { data: allTransactions },
    { data: compareTransactions },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, user_id, name, currency, starting_balance")
      .eq("user_id", user.id),
    supabase
      .from("categories")
      .select("id, name, icon, color, parent_id")
      .or(household ? `household_id.eq.${household.id}` : "household_id.is.null"),
    supabase
      .from("transactions")
      .select("id, account_id, occurred_at, description, amount, currency, category_id")
      .eq("user_id", user.id)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false }),
    // Unscoped by period -- current balance is a snapshot as of now, not
    // "as of this week/month".
    supabase.from("transactions").select("account_id, amount").eq("user_id", user.id),
    resolved.compareRange
      ? supabase
          .from("transactions")
          .select("amount, currency, category_id")
          .eq("user_id", user.id)
          .gte("occurred_at", resolved.compareRange.start)
          .lte("occurred_at", resolved.compareRange.end)
      : Promise.resolve({
          data: null as { amount: number; currency: string; category_id: string | null }[] | null,
        }),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);

  const compareTotalsByCurrency = new Map<string, { totalOut: number; totalIn: number }>();
  // Per currency, per top-level category id -- lets the category
  // breakdown show a per-row delta alongside the overall totals.
  const comparePrevByCategory = new Map<string, Map<string, number>>();
  for (const t of compareTransactions ?? []) {
    const entry = compareTotalsByCurrency.get(t.currency) ?? { totalOut: 0, totalIn: 0 };
    if (t.amount < 0) entry.totalOut += Math.abs(t.amount);
    else entry.totalIn += t.amount;
    compareTotalsByCurrency.set(t.currency, entry);

    if (t.amount >= 0) continue;
    const rawCategory = t.category_id ? categoryById.get(t.category_id) : null;
    const catId = topCategoryId(rawCategory, categoryById) ?? "uncategorized";
    const byCat = comparePrevByCategory.get(t.currency) ?? new Map<string, number>();
    byCat.set(catId, (byCat.get(catId) ?? 0) + Math.abs(t.amount));
    comparePrevByCategory.set(t.currency, byCat);
  }
  const compareLabel = resolved.compareLabel ?? undefined;

  function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return ((current - previous) / previous) * 100;
  }

  const balances = accountBalances(accounts ?? [], allTransactions ?? []);
  const balanceTotals = [...sumByCurrency(balances)].map(([currency, amount]) => ({
    currency,
    amount,
  }));

  return (
    <div className="space-y-6">
      <BalanceCard totals={balanceTotals} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodToggle
          period={resolved.mode}
          anchor={resolved.anchor}
          customRange={resolved.customRange}
          compareOn={resolved.compareOn}
          compareAnchor={resolved.compareAnchor}
          compareRange={resolved.compareRange}
          allowYear
          allowCustom
        />
        <AddTransactionDialog
          accounts={accounts ?? []}
          categories={categories ?? []}
          householdId={household?.id ?? null}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No spending in this period yet.
          </CardContent>
        </Card>
      ) : (
        [...byCurrency.entries()].map(([currency, currencyRows]) => {
          const totalOut = currencyRows
            .filter((t) => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const totalIn = currencyRows
            .filter((t) => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
          const trend = dailySpendTrend(currencyRows, start, end);

          const comparePrevForCurrency = comparePrevByCategory.get(currency);
          const byCategory = new Map<string, BreakdownDatum>();
          for (const t of currencyRows) {
            if (t.amount >= 0) continue;
            // A subcategory's spend rolls up into its parent everywhere
            // except the parent's own drill-down -- charts here always
            // group by the top-level category.
            const rawCategory = t.category_id ? categoryById.get(t.category_id) : null;
            const id = topCategoryId(rawCategory, categoryById) ?? "uncategorized";
            const category = id !== "uncategorized" ? categoryById.get(id) : null;
            const existing = byCategory.get(id);
            byCategory.set(id, {
              id,
              name: category?.name ?? "Uncategorized",
              icon: category?.icon ?? null,
              color: category?.color ?? null,
              value: (existing?.value ?? 0) + Math.abs(t.amount),
              href: `/transactions?category=${id}&${resolved.queryParams}`,
              previousValue: comparePrevForCurrency ? (comparePrevForCurrency.get(id) ?? 0) : null,
            });
          }
          const fullBreakdown = [...byCategory.values()].sort((a, b) => b.value - a.value);
          const compactBreakdown = toBreakdown(fullBreakdown);

          const compareTotals = compareTotalsByCurrency.get(currency);
          const netSpendPct = compareTotals
            ? pctChange(totalIn - totalOut, compareTotals.totalIn - compareTotals.totalOut)
            : null;
          const spentPct = compareTotals ? pctChange(totalOut, compareTotals.totalOut) : null;
          const incomePct = compareTotals ? pctChange(totalIn, compareTotals.totalIn) : null;

          return (
            <div key={currency} className="space-y-6">
              <HeroSummaryCard
                eyebrow={`${resolved.label} · ${currency}`}
                label="Net spend"
                value={formatCurrency(totalIn - totalOut, currency)}
                meta={
                  <>
                    <span>Spent {formatCurrency(totalOut, currency)}</span>
                    <span>Income {formatCurrency(totalIn, currency)}</span>
                    {netSpendPct != null && (
                      <span>
                        {netSpendPct === 0
                          ? "No change"
                          : `${netSpendPct > 0 ? "+" : ""}${Math.round(netSpendPct)}%`}{" "}
                        {compareLabel}
                      </span>
                    )}
                  </>
                }
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Spent"
                  value={formatCurrency(totalOut, currency)}
                  tone="negative"
                  trend={trend}
                  comparePct={spentPct}
                  compareLabel={compareLabel}
                />
                <StatCard
                  label="Income"
                  value={formatCurrency(totalIn, currency)}
                  tone="positive"
                  comparePct={incomePct}
                  compareLabel={compareLabel}
                />
              </div>

              <CategorySpendCard
                compact={compactBreakdown}
                full={fullBreakdown}
                currency={currency}
              />
            </div>
          );
        })
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={`/transactions?${resolved.queryParams}`} />}
            >
              View all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TransactionList
            rows={rows.slice(0, 10).map((t) => ({
              id: t.id,
              account_id: t.account_id,
              category_id: t.category_id,
              user_id: user.id,
              occurred_at: t.occurred_at,
              description: t.description,
              amount: t.amount,
              currency: t.currency,
              category_name: t.category_id ? categoryById.get(t.category_id)?.name ?? null : null,
            }))}
            editable={{ currentUserId: user.id, accounts: accounts ?? [], categories: categories ?? [] }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
