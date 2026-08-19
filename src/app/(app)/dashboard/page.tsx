import { Suspense } from "react";
import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, periodRange, type ResolvedPeriod } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { dailySpendTrend, spendTrendSeries, incomeTrendSeries, cashFlowSeries } from "@/lib/trend";
import { groupByCurrency } from "@/lib/group-by-currency";
import { sumByCurrency } from "@/lib/balance";
import { BalanceCard } from "@/components/balance-summary";
import { PeriodToggle } from "@/components/period-toggle";
import { StatCard } from "@/components/stat-card";
import { HeroSummaryCard } from "@/components/hero-summary-card";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { TransactionList } from "@/components/transaction-list";
import { CategorySpendCard } from "@/components/category-spend-card";
import { CurrencyProvider } from "@/components/currency-context";
import { CurrencyPanel } from "@/components/currency-panel";
import { TrendChart } from "@/components/charts/trend-chart";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { toBreakdown, type BreakdownDatum } from "@/lib/breakdown";
import { topCategoryId } from "@/lib/category-hierarchy";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroSkeleton, StatCardsSkeleton, ChartCardSkeleton, ListSkeleton } from "@/components/skeletons";
import type { Account, Category } from "@/lib/supabase/types";

type AccountRow = Pick<Account, "id" | "user_id" | "name" | "currency" | "starting_balance">;
type CategoryRow = Pick<Category, "id" | "name" | "icon" | "color" | "parent_id">;

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

  const supabase = await createClient();

  // Small, period-independent lookups -- fetched directly (not behind their
  // own Suspense) since they're typically fast, and this Next.js version
  // resolves sibling Suspense boundaries in document order during a client
  // transition: an earlier boundary's own fetch delays a *later* boundary's
  // fallback from appearing at all, even though the two are otherwise
  // unrelated. Splitting every section into its own boundary sounds right
  // but backfires here -- keeping this one fast lookup un-suspended (so the
  // toolbar and Add-transaction render immediately) and folding everything
  // else into a single boundary below avoids that trap.
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, user_id, name, currency, starting_balance")
      .eq("user_id", user.id),
    supabase
      .from("categories")
      .select("id, name, icon, color, parent_id")
      .eq("user_id", user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="order-2 flex flex-wrap items-center justify-between gap-3">
        <PeriodToggle allowYear allowCustom />
        <AddTransactionDialog
          accounts={accounts ?? []}
          categories={categories ?? []}
          householdId={household?.id ?? null}
        />
      </div>

      {/* Balance and the period-scoped numbers share this one boundary
          (each carrying its own `order-*` once resolved, giving Balance
          `order-1` to sit above the toolbar) -- this Next.js version
          resolves *all* sibling Suspense boundaries on a page together
          during a client transition, gated by whichever is slowest, so
          splitting Balance into its own earlier boundary (which would seem
          the more natural way to reorder it) just delays this skeleton by
          Balance's own fetch time for no benefit. Keyed by the resolved
          query string so every distinct filter change remounts it and
          re-shows the skeleton -- otherwise React's default behavior
          during a router-driven transition is to keep the *previous*
          period's numbers on screen until the new ones are ready, which
          reads as the click not having registered rather than as a fast
          load. */}
      <Suspense key={resolved.queryParams} fallback={<DashboardDataSkeleton />}>
        <DashboardData
          userId={user.id}
          resolved={resolved}
          accounts={accounts ?? []}
          categories={categories ?? []}
        />
      </Suspense>
    </div>
  );
}

function DashboardDataSkeleton() {
  return (
    <div className="order-1 space-y-6">
      <HeroSkeleton />
      <StatCardsSkeleton />
      <ChartCardSkeleton />
      <ChartCardSkeleton />
      <ListSkeleton rows={5} />
    </div>
  );
}

async function DashboardData({
  userId,
  resolved,
  accounts,
  categories,
}: {
  userId: string;
  resolved: ResolvedPeriod;
  accounts: AccountRow[];
  categories: CategoryRow[];
}) {
  // A custom range with no end picked yet still needs *something* to query
  // -- falls back to the current month rather than fetching nothing.
  const { start, end } = resolved.range ?? periodRange("month", resolved.anchor);

  const supabase = await createClient();

  const [{ data: balanceRows }, { data: transactions }, { data: compareTransactions }] = await Promise.all([
    // Computed in Postgres (not fetched-and-summed client-side) -- current
    // balance is a snapshot as of now, not "as of this week/month", and an
    // account with enough history can hold more transactions than
    // PostgREST will return from a plain unbounded select. See
    // account_balances() in supabase/migrations/0016.
    accounts.length > 0
      ? supabase.rpc("account_balances", { target_account_ids: accounts.map((a) => a.id) })
      : Promise.resolve({ data: [] as { account_id: string; user_id: string; currency: string; balance: number }[] }),
    supabase
      .from("transactions")
      .select("id, account_id, occurred_at, description, amount, currency, category_id")
      .eq("user_id", userId)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false }),
    resolved.compareRange
      ? supabase
          .from("transactions")
          .select("amount, currency, category_id, occurred_at")
          .eq("user_id", userId)
          .gte("occurred_at", resolved.compareRange.start)
          .lte("occurred_at", resolved.compareRange.end)
      : Promise.resolve({
          data: null as
            | { amount: number; currency: string; category_id: string | null; occurred_at: string }[]
            | null,
        }),
  ]);

  const balances = (balanceRows ?? []).map((b) => ({ ...b, balance: Number(b.balance) }));
  const balanceTotals = [...sumByCurrency(balances)].map(([currency, amount]) => ({
    currency,
    amount,
  }));

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);
  const compareByCurrency = groupByCurrency(compareTransactions ?? []);
  // Busiest currency first, so a household member with mostly-MAD and a
  // handful of EUR transactions lands on MAD by default instead of
  // whichever happened to sort alphabetically or come first in the rows.
  const sortedCurrencies = [...byCurrency.keys()].sort(
    (a, b) => (byCurrency.get(b)?.length ?? 0) - (byCurrency.get(a)?.length ?? 0),
  );

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

  return (
    <CurrencyProvider defaultCurrency={sortedCurrencies[0] ?? "MAD"}>
      <div className="order-1">
        <BalanceCard totals={balanceTotals} />
      </div>

      <div className="order-3 space-y-6">
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No spending in this period yet.
          </CardContent>
        </Card>
      ) : (
        <CurrencyPanel currencies={sortedCurrencies}>
        {sortedCurrencies.map((currency) => {
          const currencyRows = byCurrency.get(currency) ?? [];
          const totalOut = currencyRows
            .filter((t) => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const totalIn = currencyRows
            .filter((t) => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
          const trend = dailySpendTrend(currencyRows, start, end);

          const trendSeries = spendTrendSeries(currencyRows, start, end);
          const compareTrendSeries = resolved.compareRange
            ? spendTrendSeries(
                compareByCurrency.get(currency) ?? [],
                resolved.compareRange.start,
                resolved.compareRange.end,
              )
            : null;
          // Aligned by index (day 1 of this month vs. day 1 of last month),
          // not by calendar date -- the two periods rarely share one.
          const trendChartData = trendSeries.map((point, i) => ({
            ...point,
            compareValue: compareTrendSeries?.[i]?.value ?? null,
          }));

          const incomeTrendSeriesData = incomeTrendSeries(currencyRows, start, end);
          const compareIncomeTrendSeries = resolved.compareRange
            ? incomeTrendSeries(
                compareByCurrency.get(currency) ?? [],
                resolved.compareRange.start,
                resolved.compareRange.end,
              )
            : null;
          const incomeTrendChartData = incomeTrendSeriesData.map((point, i) => ({
            ...point,
            compareValue: compareIncomeTrendSeries?.[i]?.value ?? null,
          }));

          const cashFlowChartData = cashFlowSeries(currencyRows, start, end);

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

              {/* Compare's whole point is a period-over-period story, which
                  is what the dashed overlay on Spending/Income trend shows --
                  Cash flow (income vs. spend timing within *this* period)
                  has no compare mode of its own (see cash-flow-chart.tsx),
                  so it isn't useful to show alongside a compare. Swap rather
                  than stack: trend cards in this slot during a compare,
                  Cash flow otherwise. */}
              {resolved.compareOn ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Spending trend</CardTitle>
                      <CardAction>
                        <Badge variant="secondary">{currency}</Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <TrendChart
                        data={trendChartData}
                        currency={currency}
                        color="var(--destructive)"
                        emptyLabel="No spending in this period yet."
                        compareLabel={compareLabel}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Income trend</CardTitle>
                      <CardAction>
                        <Badge variant="secondary">{currency}</Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <TrendChart
                        data={incomeTrendChartData}
                        currency={currency}
                        color="var(--chart-3)"
                        emptyLabel="No income in this period yet."
                        compareLabel={compareLabel}
                      />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Cash flow</CardTitle>
                    <CardAction>
                      <Badge variant="secondary">{currency}</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <CashFlowChart data={cashFlowChartData} currency={currency} />
                  </CardContent>
                </Card>
              )}

              <CategorySpendCard
                compact={compactBreakdown}
                full={fullBreakdown}
                currency={currency}
              />
            </div>
          );
        })}
        </CurrencyPanel>
      )}

      {!resolved.compareOn && (
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
                user_id: userId,
                occurred_at: t.occurred_at,
                description: t.description,
                amount: t.amount,
                currency: t.currency,
                category_name: t.category_id ? categoryById.get(t.category_id)?.name ?? null : null,
              }))}
              editable={{ currentUserId: userId, accounts, categories }}
            />
          </CardContent>
        </Card>
      )}
      </div>
    </CurrencyProvider>
  );
}
