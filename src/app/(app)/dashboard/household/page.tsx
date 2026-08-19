import { Suspense } from "react";
import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, periodRange, type ResolvedPeriod } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { groupByCurrency } from "@/lib/group-by-currency";
import { sumByCurrency } from "@/lib/balance";
import { spendTrendSeries, incomeTrendSeries, cashFlowSeries } from "@/lib/trend";
import { PeriodToggle } from "@/components/period-toggle";
import { StatCard } from "@/components/stat-card";
import { HeroSummaryCard } from "@/components/hero-summary-card";
import { BalanceCard } from "@/components/balance-summary";
import { TransactionList } from "@/components/transaction-list";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategorySpendCard } from "@/components/category-spend-card";
import { CurrencyProvider } from "@/components/currency-context";
import { CurrencyPanel } from "@/components/currency-panel";
import { toBreakdown, type BreakdownDatum } from "@/lib/breakdown";
import { topCategoryId } from "@/lib/category-hierarchy";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroSkeleton, StatCardsSkeleton, ChartCardSkeleton, ListSkeleton } from "@/components/skeletons";

export default async function HouseholdDashboardPage({
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

  if (!household) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No household yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite your partner to see a combined dashboard. Nothing is shared
            until they accept.
          </p>
          <Button nativeButton={false} render={<Link href="/settings/household" />}>
            Invite member
          </Button>
        </CardContent>
      </Card>
    );
  }

  const params = await searchParams;
  const resolved = resolvePeriod(params);

  return (
    <div className="flex flex-col gap-6">
      <div className="order-2 flex">
        <PeriodToggle allowYear allowCustom />
      </div>

      {/* Household roster/balances and the period-scoped numbers share this
          one boundary (each carrying its own `order-*` once resolved,
          giving Balance `order-1` to sit above the toolbar) -- this
          Next.js version resolves *all* sibling Suspense boundaries on a
          page together during a client transition, gated by whichever is
          slowest, so splitting Balance into its own earlier boundary
          (which would seem the more natural way to reorder it) just delays
          this skeleton by Balance's own fetch time for no benefit. Keyed
          by the resolved query string so every distinct filter change
          remounts it and re-shows the skeleton -- otherwise React's
          default behavior during a router-driven transition is to keep
          the *previous* period's numbers on screen until the new ones are
          ready, which reads as the click not having registered rather
          than as a fast load. */}
      <Suspense key={resolved.queryParams} fallback={<HouseholdDataSkeleton />}>
        <HouseholdDashboardData
          userId={user.id}
          householdId={household.id}
          householdName={household.name}
          resolved={resolved}
        />
      </Suspense>
    </div>
  );
}

function HouseholdDataSkeleton() {
  return (
    <div className="order-1 space-y-6">
      <HeroSkeleton />
      <StatCardsSkeleton />
      <ChartCardSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

async function HouseholdDashboardData({
  userId,
  householdId,
  householdName,
  resolved,
}: {
  userId: string;
  householdId: string;
  householdName: string | null;
  resolved: ResolvedPeriod;
}) {
  // A custom range with no end picked yet still needs *something* to query
  // -- falls back to the current month rather than fetching nothing.
  const { start, end } = resolved.range ?? periodRange("month", resolved.anchor);

  const supabase = await createClient();

  const [
    { data: categories },
    { data: ownCategories },
    { data: accounts },
    { data: members },
    { data: transactions },
    { data: compareTransactions },
  ] = await Promise.all([
    // No ownership filter -- RLS returns the caller's own categories
    // unioned with every household member's, read-only, which is exactly
    // the set needed to label every member's transactions on this page.
    supabase.from("categories").select("id, name, icon, color, parent_id"),
    // Own-only -- feeds the editable row dropdown, which only ever applies
    // to your own transactions (see TransactionList's canEdit), so a
    // partner's similarly-named categories shouldn't show up as choices.
    supabase.from("categories").select("id, name, icon, color, parent_id").eq("user_id", userId),
    supabase.from("accounts").select("id, name, currency").eq("user_id", userId),
    supabase.from("household_members").select("user_id").eq("household_id", householdId),
    supabase
      .from("transactions")
      .select("id, account_id, occurred_at, description, amount, currency, category_id, user_id")
      .eq("household_id", householdId)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false }),
    resolved.compareRange
      ? supabase
          .from("transactions")
          .select("amount, currency, category_id, occurred_at")
          .eq("household_id", householdId)
          .gte("occurred_at", resolved.compareRange.start)
          .lte("occurred_at", resolved.compareRange.end)
      : Promise.resolve({
          data: null as
            | { amount: number; currency: string; category_id: string | null; occurred_at: string }[]
            | null,
        }),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);

  const [{ data: profiles }, { data: memberAccounts }] = memberIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", memberIds),
        supabase.from("accounts").select("id, user_id, currency, starting_balance").in("user_id", memberIds),
      ])
    : [{ data: [] }, { data: [] }];

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Partner"]));

  // Computed in Postgres, not fetched-and-summed client-side -- besides
  // sidestepping PostgREST's row cap on a large transaction history (see
  // account_balances() in supabase/migrations/0016), running as the
  // calling user means transactions RLS itself decides what's summed:
  // all of your own transactions regardless of household_id, plus only
  // the household_id-tagged ones from a partner. No need to fetch and
  // merge those two sets by hand here anymore.
  const memberAccountIds = (memberAccounts ?? []).map((a) => a.id);
  const { data: balanceRows } =
    memberAccountIds.length > 0
      ? await supabase.rpc("account_balances", { target_account_ids: memberAccountIds })
      : { data: [] as { account_id: string; user_id: string; currency: string; balance: number }[] };
  const balances = (balanceRows ?? []).map((b) => ({ ...b, balance: Number(b.balance) }));
  const balanceTotals = [...sumByCurrency(balances)].map(([currency, amount]) => ({
    currency,
    amount,
  }));

  const balanceByPersonAndCurrency = new Map<string, Map<string, number>>();
  for (const b of balances) {
    const byPerson = balanceByPersonAndCurrency.get(b.currency) ?? new Map<string, number>();
    byPerson.set(b.user_id, (byPerson.get(b.user_id) ?? 0) + b.balance);
    balanceByPersonAndCurrency.set(b.currency, byPerson);
  }
  const balanceByPersonGroups = [...balanceByPersonAndCurrency.entries()].map(
    ([currency, byPerson]) => ({
      currency,
      people: [...byPerson.entries()].map(([memberId, amount]) => ({
        id: memberId,
        name: nameById.get(memberId) ?? "Unknown",
        amount,
        isYou: memberId === userId,
      })),
    }),
  );

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);
  const compareByCurrency = groupByCurrency(compareTransactions ?? []);
  // Busiest currency first, so a household with mostly-MAD and a handful
  // of EUR transactions lands on MAD by default instead of whichever
  // happened to sort alphabetically or come first in the rows.
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
        <BalanceCard title="Household balance" totals={balanceTotals} byPerson={balanceByPersonGroups} />
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

          const trendSeries = spendTrendSeries(currencyRows, start, end);
          const compareTrendSeries = resolved.compareRange
            ? spendTrendSeries(
                compareByCurrency.get(currency) ?? [],
                resolved.compareRange.start,
                resolved.compareRange.end,
              )
            : null;
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
          const byPerson = new Map<string, BreakdownDatum>();
          for (const t of currencyRows) {
            if (t.amount >= 0) continue;
            const rawCategory = t.category_id ? categoryById.get(t.category_id) : null;
            const catId = topCategoryId(rawCategory, categoryById) ?? "uncategorized";
            const category = catId !== "uncategorized" ? categoryById.get(catId) : null;
            const existingCat = byCategory.get(catId);
            byCategory.set(catId, {
              id: catId,
              name: category?.name ?? "Uncategorized",
              icon: category?.icon ?? null,
              color: category?.color ?? null,
              value: (existingCat?.value ?? 0) + Math.abs(t.amount),
              href: `/transactions?category=${catId}&scope=household&${resolved.queryParams}`,
              previousValue: comparePrevForCurrency ? (comparePrevForCurrency.get(catId) ?? 0) : null,
            });

            const existingPerson = byPerson.get(t.user_id);
            byPerson.set(t.user_id, {
              id: t.user_id,
              name: nameById.get(t.user_id) ?? "Unknown",
              value: (existingPerson?.value ?? 0) + Math.abs(t.amount),
            });
          }

          const fullCategoryBreakdown = [...byCategory.values()].sort((a, b) => b.value - a.value);
          const categoryBreakdown = toBreakdown(fullCategoryBreakdown);
          const personBreakdown = [...byPerson.values()].sort((a, b) => b.value - a.value);

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
                label={householdName ?? "Household"}
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
                  label="Total spent"
                  value={formatCurrency(totalOut, currency)}
                  tone="negative"
                  comparePct={spentPct}
                  compareLabel={compareLabel}
                />
                <StatCard
                  label="Total income"
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

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CategorySpendCard
                  compact={categoryBreakdown}
                  full={fullCategoryBreakdown}
                  currency={currency}
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Spend by person</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BreakdownChart data={personBreakdown} currency={currency} />
                  </CardContent>
                </Card>
              </div>
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
                render={<Link href={`/transactions?scope=household&${resolved.queryParams}`} />}
              >
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TransactionList
              showOwner
              rows={rows.slice(0, 15).map((t) => ({
                id: t.id,
                account_id: t.account_id,
                category_id: t.category_id,
                user_id: t.user_id,
                occurred_at: t.occurred_at,
                description: t.description,
                amount: t.amount,
                currency: t.currency,
                category_name: t.category_id ? categoryById.get(t.category_id)?.name ?? null : null,
                owner_name: nameById.get(t.user_id) ?? null,
              }))}
              editable={{ currentUserId: userId, accounts: accounts ?? [], categories: ownCategories ?? [] }}
            />
          </CardContent>
        </Card>
      )}
      </div>
    </CurrencyProvider>
  );
}
