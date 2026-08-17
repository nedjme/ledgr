import { Suspense } from "react";
import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, periodRange, type ResolvedPeriod } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { groupByCurrency } from "@/lib/group-by-currency";
import { accountBalances, sumByCurrency } from "@/lib/balance";
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
import { toBreakdown, type BreakdownDatum } from "@/lib/breakdown";
import { topCategoryId } from "@/lib/category-hierarchy";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroSkeleton, StatCardsSkeleton, ChartCardSkeleton, ListSkeleton } from "@/components/skeletons";

type CategoryRow = { id: string; name: string; icon: string | null; color: string | null; parent_id: string | null };
type AccountRow = { id: string; name: string; currency: string };

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

  const supabase = await createClient();

  // Period-independent -- household roster, balances, and categories don't
  // change based on the selected period, so they're fetched here (outside
  // the Suspense boundary below) and the balance card + toolbar render with
  // them immediately, without waiting on the period-scoped transactions.
  const [{ data: categories }, { data: members }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("id, name, icon, color, parent_id").eq("household_id", household.id),
    supabase.from("household_members").select("user_id").eq("household_id", household.id),
    supabase.from("accounts").select("id, name, currency").eq("user_id", user.id),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const otherMemberIds = memberIds.filter((id) => id !== user.id);

  const [{ data: profiles }, { data: memberAccounts }, { data: ownTransactions }, { data: sharedTransactions }] =
    memberIds.length
      ? await Promise.all([
          supabase.from("profiles").select("id, display_name").in("id", memberIds),
          supabase
            .from("accounts")
            .select("id, user_id, currency, starting_balance")
            .in("user_id", memberIds),
          // Unscoped by period -- current balance is a snapshot as of now.
          // The current user's own balance uses every transaction they've
          // ever logged (same query the personal dashboard uses), not just
          // the ones tagged household_id -- a transaction recorded before a
          // household existed (e.g. an import done pre-signup) never gets
          // retroactively tagged, so scoping this to household_id alone
          // undercounts your own balance.
          supabase
            .from("transactions")
            .select("account_id, user_id, amount, currency")
            .eq("user_id", user.id),
          // A partner's balance, in contrast, can only be built from what
          // they've explicitly shared with the household -- RLS hides the
          // rest of their transactions, so this may undercount if they have
          // unshared history of their own.
          otherMemberIds.length
            ? supabase
                .from("transactions")
                .select("account_id, user_id, amount, currency")
                .eq("household_id", household.id)
                .in("user_id", otherMemberIds)
            : Promise.resolve({ data: [] as { account_id: string; user_id: string; amount: number; currency: string }[] }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Partner"]));

  const allTransactions = [...(ownTransactions ?? []), ...(sharedTransactions ?? [])];
  const balances = accountBalances(memberAccounts ?? [], allTransactions);
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
      people: [...byPerson.entries()].map(([userId, amount]) => ({
        id: userId,
        name: nameById.get(userId) ?? "Unknown",
        amount,
        isYou: userId === user.id,
      })),
    }),
  );

  return (
    <div className="space-y-6">
      <BalanceCard
        title="Household balance"
        totals={balanceTotals}
        byPerson={balanceByPersonGroups}
      />

      <div className="flex justify-end">
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
      </div>

      {/* Keyed by the resolved query string so every distinct filter change
          remounts this boundary and re-shows the skeleton, instead of
          leaving the previous period's numbers frozen on screen for the
          duration of the refetch -- see the equivalent comment in the
          personal dashboard's page.tsx. */}
      <Suspense key={resolved.queryParams} fallback={<HouseholdDataSkeleton />}>
        <HouseholdDashboardData
          userId={user.id}
          householdId={household.id}
          householdName={household.name}
          resolved={resolved}
          categories={categories ?? []}
          accounts={accounts ?? []}
          nameById={nameById}
        />
      </Suspense>
    </div>
  );
}

function HouseholdDataSkeleton() {
  return (
    <div className="space-y-6">
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
  categories,
  accounts,
  nameById,
}: {
  userId: string;
  householdId: string;
  householdName: string | null;
  resolved: ResolvedPeriod;
  categories: CategoryRow[];
  accounts: AccountRow[];
  nameById: Map<string, string>;
}) {
  // A custom range with no end picked yet still needs *something* to query
  // -- falls back to the current month rather than fetching nothing.
  const { start, end } = resolved.range ?? periodRange("month", resolved.anchor);

  const supabase = await createClient();

  const [{ data: transactions }, { data: compareTransactions }] = await Promise.all([
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

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);
  const compareByCurrency = groupByCurrency(compareTransactions ?? []);

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
    <>
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
        })
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
              editable={{ currentUserId: userId, accounts, categories }}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
