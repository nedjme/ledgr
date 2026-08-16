import Link from "next/link";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { periodRange, parsePeriod, parseAnchor, periodLabel } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { groupByCurrency } from "@/lib/group-by-currency";
import { PeriodToggle } from "@/components/period-toggle";
import { StatCard } from "@/components/stat-card";
import { HeroSummaryCard } from "@/components/hero-summary-card";
import { TransactionList } from "@/components/transaction-list";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { toBreakdown } from "@/lib/breakdown";
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
      supabase.from("categories").select("id, name").eq("household_id", household.id),
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
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Partner"]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const rows = transactions ?? [];
  const byCurrency = groupByCurrency(rows);

  return (
    <div className="space-y-6">
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

          const byCategory = new Map<string, number>();
          const byPerson = new Map<string, number>();
          for (const t of currencyRows) {
            if (t.amount >= 0) continue;
            const catName =
              (t.category_id && categoryById.get(t.category_id)) || "Uncategorized";
            byCategory.set(catName, (byCategory.get(catName) ?? 0) + Math.abs(t.amount));

            const personName = nameById.get(t.user_id) ?? "Unknown";
            byPerson.set(personName, (byPerson.get(personName) ?? 0) + Math.abs(t.amount));
          }

          const categoryBreakdown = toBreakdown(
            [...byCategory.entries()].map(([name, value]) => ({ name, value })),
          );
          const personBreakdown = [...byPerson.entries()].map(([name, value]) => ({
            name,
            value,
          }));

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
                <Card>
                  <CardHeader>
                    <CardTitle>Spend by category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BreakdownChart data={categoryBreakdown} currency={currency} />
                  </CardContent>
                </Card>
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
              category_name: t.category_id ? categoryById.get(t.category_id) ?? null : null,
              owner_name: nameById.get(t.user_id) ?? null,
            }))}
            editable={{ currentUserId: user.id, accounts: accounts ?? [], categories: categories ?? [] }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
