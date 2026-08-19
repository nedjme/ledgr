import { Suspense } from "react";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, type ResolvedPeriod } from "@/lib/period";
import { formatCurrency } from "@/lib/format";
import { TransactionsFilterBar } from "@/components/transactions-filter-bar";
import { PeriodToggle } from "@/components/period-toggle";
import { TransactionList } from "@/components/transaction-list";
import { CategoryMiniReport } from "@/components/category-mini-report";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { Pagination } from "@/components/pagination";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCardSkeleton, ListSkeleton } from "@/components/skeletons";
import type { BreakdownDatum } from "@/lib/breakdown";

const PAGE_SIZE = 30;

type SearchParams = {
  scope?: string;
  q?: string;
  category?: string;
  page?: string;
  period?: string;
  anchor?: string;
  start?: string;
  end?: string;
  compare?: string;
  compareAnchor?: string;
  compareStart?: string;
  compareEnd?: string;
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const params = await searchParams;

  const scope = params.scope === "household" && household ? "household" : "personal";
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  // "All time" (no period param at all) is a state resolvePeriod doesn't
  // know about -- it always resolves to a concrete Period, defaulting to
  // "month" -- so it's layered on top here rather than passed down.
  const isAllTime = !params.period;
  const resolved = resolvePeriod(params);

  // Small, filter-independent lookup -- fetched directly (not behind its
  // own Suspense) since it's typically fast, and this Next.js version
  // resolves sibling Suspense boundaries in document order during a client
  // transition: an earlier boundary's own fetch would delay the *data*
  // boundary's fallback from appearing at all, even though the two are
  // otherwise unrelated. It also can't share the data boundary below --
  // that one remounts on every keystroke (see its key), which would blow
  // away the filter bar's own search-input state if the two were merged.
  const supabase = await createClient();
  // Own categories only -- this feeds the filter bar's search/pick combobox,
  // and a household member's categories (however similarly named) aren't
  // meaningful choices to filter *your own* transactions by.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon, color, parent_id")
    .eq("user_id", user.id)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TransactionsFilterBar categories={categories ?? []} showScope={!!household} q={q} />
        <PeriodToggle allowAll allowYear allowCustom />
      </div>

      {/* Keyed by every filter-affecting param so a search keystroke, a
          category pick, a page click, or a period change all remount this
          boundary and re-show its skeleton -- without a key, React keeps the
          previous page's rows frozen on screen for the duration of the
          refetch (a transition-update default), which reads as the filter
          not having done anything rather than as a fast reload. */}
      <Suspense key={JSON.stringify(params)} fallback={<TransactionsDataSkeleton />}>
        <TransactionsData
          userId={user.id}
          householdId={household?.id ?? null}
          scope={scope}
          q={q}
          category={category}
          page={page}
          isAllTime={isAllTime}
          resolved={resolved}
          rawParams={params}
        />
      </Suspense>
    </div>
  );
}

function TransactionsDataSkeleton() {
  return (
    <div className="space-y-6">
      <ChartCardSkeleton />
      <ListSkeleton rows={10} />
    </div>
  );
}

async function TransactionsData({
  userId,
  householdId,
  scope,
  q,
  category,
  page,
  isAllTime,
  resolved,
  rawParams,
}: {
  userId: string;
  householdId: string | null;
  scope: "personal" | "household";
  q: string;
  category: string;
  page: number;
  isAllTime: boolean;
  resolved: ResolvedPeriod;
  rawParams: SearchParams;
}) {
  const range = isAllTime ? null : resolved.range;
  const compareRange = isAllTime ? null : resolved.compareRange;
  const compareLabel = isAllTime ? undefined : (resolved.compareLabel ?? undefined);
  const showReport = category !== "";
  const showTotals = showReport || compareRange !== null;

  const supabase = await createClient();

  // `categories` has no ownership filter -- RLS returns own categories
  // unioned with a household member's, read-only, which is what resolving
  // a household-scoped transaction's category (and the subcategory
  // widening below) needs. `ownCategories` is the narrower, own-only list
  // for the editable row dropdown -- editing only ever applies to your own
  // transactions (see TransactionList's canEdit), so a partner's
  // similarly-named categories have no business showing up as choices there.
  const [{ data: categories }, { data: ownCategories }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("id, name, icon, color, parent_id").order("name"),
    supabase
      .from("categories")
      .select("id, name, icon, color, parent_id")
      .eq("user_id", userId)
      .order("name"),
    supabase.from("accounts").select("id, name, currency").eq("user_id", userId),
  ]);

  // Fetched ahead of the rest -- the transaction/report queries below need
  // to know a clicked category's subcategory ids (if any) to widen their
  // filter from "this exact category" to "this category or its children",
  // so a subcategory's spend still counts toward its parent's drill-down.
  const childCategoryIds = (categories ?? []).filter((c) => c.parent_id === category).map((c) => c.id);
  const categoryFilterIds = childCategoryIds.length > 0 ? [category, ...childCategoryIds] : null;

  // Query construction is synchronous (no network call happens until it's
  // awaited below), so these can all join the same Promise.all -- none
  // need each other's results. Filters are duplicated per query rather
  // than shared through a generic helper because passing a non-literal
  // `select()` string breaks Supabase's row-type inference entirely.
  let transactionsQuery = supabase
    .from("transactions")
    .select(
      "id, account_id, occurred_at, description, description_key, amount, currency, category_id, user_id",
      { count: "exact" },
    );
  transactionsQuery =
    scope === "household"
      ? transactionsQuery.eq("household_id", householdId!)
      : transactionsQuery.eq("user_id", userId);
  if (q) transactionsQuery = transactionsQuery.ilike("description", `%${q}%`);
  if (category === "uncategorized") transactionsQuery = transactionsQuery.is("category_id", null);
  else if (category) {
    transactionsQuery = categoryFilterIds
      ? transactionsQuery.in("category_id", categoryFilterIds)
      : transactionsQuery.eq("category_id", category);
  }
  if (range) transactionsQuery = transactionsQuery.gte("occurred_at", range.start).lte("occurred_at", range.end);

  let reportQuery = supabase.from("transactions").select("amount, currency, category_id");
  reportQuery =
    scope === "household"
      ? reportQuery.eq("household_id", householdId!)
      : reportQuery.eq("user_id", userId);
  if (q) reportQuery = reportQuery.ilike("description", `%${q}%`);
  if (category === "uncategorized") reportQuery = reportQuery.is("category_id", null);
  else if (category) {
    reportQuery = categoryFilterIds
      ? reportQuery.in("category_id", categoryFilterIds)
      : reportQuery.eq("category_id", category);
  }
  if (range) reportQuery = reportQuery.gte("occurred_at", range.start).lte("occurred_at", range.end);

  let previousReportQuery = supabase.from("transactions").select("amount, currency");
  previousReportQuery =
    scope === "household"
      ? previousReportQuery.eq("household_id", householdId!)
      : previousReportQuery.eq("user_id", userId);
  if (q) previousReportQuery = previousReportQuery.ilike("description", `%${q}%`);
  if (category === "uncategorized") previousReportQuery = previousReportQuery.is("category_id", null);
  else if (category) {
    previousReportQuery = categoryFilterIds
      ? previousReportQuery.in("category_id", categoryFilterIds)
      : previousReportQuery.eq("category_id", category);
  }
  if (compareRange) {
    previousReportQuery = previousReportQuery
      .gte("occurred_at", compareRange.start)
      .lte("occurred_at", compareRange.end);
  }

  const from = (page - 1) * PAGE_SIZE;

  const [{ data: transactions, count }, membersResult, reportRows, previousReportRows] = await Promise.all([
    transactionsQuery.order("occurred_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    scope === "household"
      ? supabase.from("household_members").select("user_id").eq("household_id", householdId!)
      : Promise.resolve({ data: null as { user_id: string }[] | null }),
    showTotals
      ? reportQuery
      : Promise.resolve({
          data: null as { amount: number; currency: string; category_id: string | null }[] | null,
        }),
    showTotals && compareRange
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
  // Per-currency breakdown of the parent's own direct spend vs. each of its
  // subcategories -- only populated when the clicked category has children.
  const subcategoryByCurrency = new Map<string, Map<string, BreakdownDatum>>();
  for (const t of reportRows.data ?? []) {
    if (t.amount >= 0) continue;
    const entry = byCurrency.get(t.currency) ?? { total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    byCurrency.set(t.currency, entry);

    if (childCategoryIds.length > 0) {
      const bucketId = t.category_id ?? category;
      const bucketCategory = t.category_id ? categoryById.get(t.category_id) : reportCategory;
      const subMap = subcategoryByCurrency.get(t.currency) ?? new Map<string, BreakdownDatum>();
      const existing = subMap.get(bucketId);
      subMap.set(bucketId, {
        id: bucketId,
        name: bucketCategory?.name ?? "Uncategorized",
        icon: bucketCategory?.icon ?? null,
        color: bucketCategory?.color ?? null,
        value: (existing?.value ?? 0) + Math.abs(t.amount),
      });
      subcategoryByCurrency.set(t.currency, subMap);
    }
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
        compareRange && previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;
      return { currency, total, count, trendVsPreviousPct };
    });

  return (
    <>
      {showReport && reportGroups.length > 0 && (
        <CategoryMiniReport
          name={reportCategory?.name ?? "Uncategorized"}
          icon={reportCategory?.icon ?? null}
          categoryId={category}
          color={reportCategory?.color ?? null}
          groups={reportGroups}
          compareLabel={compareLabel}
        />
      )}

      {!showReport && compareRange && reportGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reportGroups.map((group) => (
            <StatCard
              key={group.currency}
              label={`Total spent (${group.currency})`}
              value={formatCurrency(group.total, group.currency)}
              tone="negative"
              comparePct={group.trendVsPreviousPct}
              compareLabel={compareLabel}
            />
          ))}
        </div>
      )}

      {[...subcategoryByCurrency.entries()].map(([currency, subMap]) => (
        <Card key={currency}>
          <CardHeader>
            <CardTitle>
              By subcategory{subcategoryByCurrency.size > 1 ? ` · ${currency}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownChart data={[...subMap.values()]} currency={currency} />
          </CardContent>
        </Card>
      ))}

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
              description_key: t.description_key,
              amount: t.amount,
              currency: t.currency,
              category_name: t.category_id ? categoryById.get(t.category_id)?.name ?? null : null,
              owner_name: scope === "household" ? nameById.get(t.user_id) ?? null : null,
            }))}
            editable={{ currentUserId: userId, accounts: accounts ?? [], categories: ownCategories ?? [] }}
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
          period: rawParams.period,
          anchor: rawParams.anchor,
          start: rawParams.start,
          end: rawParams.end,
          compare: rawParams.compare,
          compareAnchor: rawParams.compareAnchor,
          compareStart: rawParams.compareStart,
          compareEnd: rawParams.compareEnd,
        }}
      />
    </>
  );
}
