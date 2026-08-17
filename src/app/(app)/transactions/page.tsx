import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, parseAnchor, periodRange, shiftAnchor } from "@/lib/period";
import { TransactionsFilterBar } from "@/components/transactions-filter-bar";
import { TransactionList } from "@/components/transaction-list";
import { CategoryMiniReport } from "@/components/category-mini-report";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_SIZE = 30;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    q?: string;
    category?: string;
    page?: string;
    period?: string;
    anchor?: string;
  }>;
}) {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const params = await searchParams;

  const scope = params.scope === "household" && household ? "household" : "personal";
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const hasPeriod = !!params.period;
  const period = parsePeriod(params.period);
  const anchor = parseAnchor(params.anchor);
  const range = hasPeriod ? periodRange(period, anchor) : null;
  const showReport = category !== "";

  const supabase = await createClient();

  // Query construction is synchronous (no network call happens until it's
  // awaited below), so these can all join the same Promise.all -- none
  // need each other's results. Filters are duplicated per query rather
  // than shared through a generic helper because passing a non-literal
  // `select()` string breaks Supabase's row-type inference entirely.
  let transactionsQuery = supabase
    .from("transactions")
    .select(
      "id, account_id, occurred_at, description, amount, currency, category_id, user_id",
      { count: "exact" },
    );
  transactionsQuery =
    scope === "household"
      ? transactionsQuery.eq("household_id", household!.id)
      : transactionsQuery.eq("user_id", user.id);
  if (q) transactionsQuery = transactionsQuery.ilike("description", `%${q}%`);
  if (category === "uncategorized") transactionsQuery = transactionsQuery.is("category_id", null);
  else if (category) transactionsQuery = transactionsQuery.eq("category_id", category);
  if (range) transactionsQuery = transactionsQuery.gte("occurred_at", range.start).lte("occurred_at", range.end);

  let reportQuery = supabase.from("transactions").select("amount, currency");
  reportQuery =
    scope === "household"
      ? reportQuery.eq("household_id", household!.id)
      : reportQuery.eq("user_id", user.id);
  if (q) reportQuery = reportQuery.ilike("description", `%${q}%`);
  if (category === "uncategorized") reportQuery = reportQuery.is("category_id", null);
  else if (category) reportQuery = reportQuery.eq("category_id", category);
  if (range) reportQuery = reportQuery.gte("occurred_at", range.start).lte("occurred_at", range.end);

  const prevRange = range ? periodRange(period, shiftAnchor(period, anchor, -1)) : null;
  let previousReportQuery = supabase.from("transactions").select("amount, currency");
  previousReportQuery =
    scope === "household"
      ? previousReportQuery.eq("household_id", household!.id)
      : previousReportQuery.eq("user_id", user.id);
  if (category === "uncategorized") previousReportQuery = previousReportQuery.is("category_id", null);
  else if (category) previousReportQuery = previousReportQuery.eq("category_id", category);
  if (prevRange) {
    previousReportQuery = previousReportQuery
      .gte("occurred_at", prevRange.start)
      .lte("occurred_at", prevRange.end);
  }

  const from = (page - 1) * PAGE_SIZE;

  const [
    { data: categories },
    { data: accounts },
    { data: transactions, count },
    membersResult,
    reportRows,
    previousReportRows,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, icon, color")
      .or(household ? `household_id.eq.${household.id}` : "household_id.is.null")
      .order("name"),
    supabase.from("accounts").select("id, name, currency").eq("user_id", user.id),
    transactionsQuery.order("occurred_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    scope === "household"
      ? supabase.from("household_members").select("user_id").eq("household_id", household!.id)
      : Promise.resolve({ data: null as { user_id: string }[] | null }),
    showReport ? reportQuery : Promise.resolve({ data: null as { amount: number; currency: string }[] | null }),
    showReport && prevRange
      ? previousReportQuery
      : Promise.resolve({ data: null as { amount: number; currency: string }[] | null }),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const rows = transactions ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  let nameById = new Map<string, string>();
  if (scope === "household") {
    const memberIds = (membersResult.data ?? []).map((m) => m.user_id);
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Partner"]));
    }
  }

  const reportCategory = category === "uncategorized" ? null : categoryById.get(category) ?? null;

  // A category can have spend in more than one currency (different
  // household members' accounts), so the report groups by currency instead
  // of summing everything into one number that would mix MAD and EUR.
  const byCurrency = new Map<string, { total: number; count: number }>();
  for (const t of reportRows.data ?? []) {
    if (t.amount >= 0) continue;
    const entry = byCurrency.get(t.currency) ?? { total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    byCurrency.set(t.currency, entry);
  }

  const previousTotalByCurrency = new Map<string, number>();
  for (const t of previousReportRows.data ?? []) {
    if (t.amount >= 0) continue;
    previousTotalByCurrency.set(
      t.currency,
      (previousTotalByCurrency.get(t.currency) ?? 0) + Math.abs(t.amount),
    );
  }

  const reportGroups = [...byCurrency.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([currency, { total, count }]) => {
      const previousTotal = previousTotalByCurrency.get(currency) ?? 0;
      const trendVsPreviousPct =
        range && previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;
      return { currency, total, count, trendVsPreviousPct };
    });

  return (
    <div className="space-y-6">
      {showReport && reportGroups.length > 0 && (
        <CategoryMiniReport
          name={reportCategory?.name ?? "Uncategorized"}
          icon={reportCategory?.icon ?? null}
          categoryId={category}
          color={reportCategory?.color ?? null}
          groups={reportGroups}
        />
      )}

      <TransactionsFilterBar
        categories={categories ?? []}
        showScope={!!household}
        scope={scope}
        q={q}
        category={category}
      />

      <Card>
        <CardContent>
          <TransactionList
            showOwner={scope === "household"}
            rows={rows.map((t) => ({
              id: t.id,
              account_id: t.account_id,
              category_id: t.category_id,
              user_id: t.user_id,
              occurred_at: t.occurred_at,
              description: t.description,
              amount: t.amount,
              currency: t.currency,
              category_name: t.category_id ? categoryById.get(t.category_id)?.name ?? null : null,
              owner_name: scope === "household" ? nameById.get(t.user_id) ?? null : null,
            }))}
            editable={{ currentUserId: user.id, accounts: accounts ?? [], categories: categories ?? [] }}
          />
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/transactions"
        params={{
          scope: scope === "household" ? "household" : undefined,
          q,
          category,
          period: params.period,
          anchor: params.anchor,
        }}
      />
    </div>
  );
}
