import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { periodRange, parsePeriod, parseAnchor, periodLabel } from "@/lib/period";
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
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { toBreakdown } from "@/lib/breakdown";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; anchor?: string }>;
}) {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const anchor = parseAnchor(params.anchor);
  const { start, end } = periodRange(period, anchor);

  const supabase = await createClient();

  const [{ data: accounts }, { data: categories }, { data: transactions }, { data: allTransactions }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, user_id, name, currency, starting_balance")
        .eq("user_id", user.id),
      supabase
        .from("categories")
        .select("id, name")
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
    ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);

  const balances = accountBalances(accounts ?? [], allTransactions ?? []);
  const balanceTotals = [...sumByCurrency(balances)].map(([currency, amount]) => ({
    currency,
    amount,
  }));

  return (
    <div className="space-y-6">
      <BalanceCard totals={balanceTotals} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodToggle period={period} anchor={anchor} />
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

          const byCategory = new Map<string, number>();
          for (const t of currencyRows) {
            if (t.amount >= 0) continue;
            const name =
              (t.category_id && categoryById.get(t.category_id)) || "Uncategorized";
            byCategory.set(name, (byCategory.get(name) ?? 0) + Math.abs(t.amount));
          }
          const breakdown = toBreakdown(
            [...byCategory.entries()].map(([name, value]) => ({ name, value })),
          );

          return (
            <div key={currency} className="space-y-6">
              <HeroSummaryCard
                eyebrow={`${periodLabel(period, anchor)} · ${currency}`}
                label="Net spend"
                value={formatCurrency(totalIn - totalOut, currency)}
                meta={
                  <>
                    <span>Spent {formatCurrency(totalOut, currency)}</span>
                    <span>Income {formatCurrency(totalIn, currency)}</span>
                  </>
                }
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Spent"
                  value={formatCurrency(totalOut, currency)}
                  tone="negative"
                  trend={trend}
                />
                <StatCard
                  label="Income"
                  value={formatCurrency(totalIn, currency)}
                  tone="positive"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Spend by category</CardTitle>
                </CardHeader>
                <CardContent>
                  <BreakdownChart data={breakdown} currency={currency} />
                </CardContent>
              </Card>
            </div>
          );
        })
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/transactions" />}>
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
              category_name: t.category_id ? categoryById.get(t.category_id) ?? null : null,
            }))}
            editable={{ currentUserId: user.id, accounts: accounts ?? [], categories: categories ?? [] }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
