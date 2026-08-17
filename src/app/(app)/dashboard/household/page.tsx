import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { periodRange, parsePeriod, parseAnchor, periodLabel, anchorParam } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { groupByCurrency } from "@/lib/group-by-currency";
import { accountBalances, sumByCurrency } from "@/lib/balance";
import { PeriodToggle } from "@/components/period-toggle";
import { StatCard } from "@/components/stat-card";
import { HeroSummaryCard } from "@/components/hero-summary-card";
import { BalanceCard } from "@/components/balance-summary";
import { TransactionList } from "@/components/transaction-list";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { CategorySpendCard } from "@/components/category-spend-card";
import { toBreakdown, type BreakdownDatum } from "@/lib/breakdown";
import { topCategoryId } from "@/lib/category-hierarchy";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function HouseholdDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; anchor?: string }>;
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
  const period = parsePeriod(params.period);
  const anchor = parseAnchor(params.anchor);
  const { start, end } = periodRange(period, anchor);

  const supabase = await createClient();

  const [{ data: categories }, { data: transactions }, { data: members }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, icon, color, parent_id")
        .eq("household_id", household.id),
      supabase
        .from("transactions")
        .select(
          "id, account_id, occurred_at, description, amount, currency, category_id, user_id",
        )
        .eq("household_id", household.id)
        .gte("occurred_at", start)
        .lte("occurred_at", end)
        .order("occurred_at", { ascending: false }),
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
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);

  const periodParams = `period=${period}&anchor=${anchorParam(anchor)}`;

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
        <PeriodToggle period={period} anchor={anchor} />
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
              href: `/transactions?category=${catId}&scope=household&${periodParams}`,
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

          return (
            <div key={currency} className="space-y-6">
              <HeroSummaryCard
                eyebrow={`${periodLabel(period, anchor)} · ${currency}`}
                label={household.name ?? "Household"}
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
                  label="Total spent"
                  value={formatCurrency(totalOut, currency)}
                  tone="negative"
                />
                <StatCard
                  label="Total income"
                  value={formatCurrency(totalIn, currency)}
                  tone="positive"
                />
              </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/transactions?scope=household" />}
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
            editable={{ currentUserId: user.id, accounts: accounts ?? [], categories: categories ?? [] }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
