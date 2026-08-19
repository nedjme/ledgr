import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { BudgetsGoalsTabs } from "@/components/budgets-goals-tabs";
import { budgetMonthRange, budgetSpent, weeklyBudgetBreakdown } from "@/lib/budgets";
import {
  MAX_SAVINGS_WINDOW_MONTHS,
  trailingMonthsRange,
  averageMonthlySavingsByWindow,
  type RecurrenceKind,
} from "@/lib/goals";

const TRANSACTIONS_PAGE_SIZE = 1000;

// PostgREST caps a plain select at 1000 rows -- a household with enough
// history can trivially exceed that within the trailing window this page
// needs for the savings-history dropdown (see MAX_SAVINGS_WINDOW_MONTHS),
// silently dropping everything past the cutoff instead of erroring, which
// is exactly what was truncating this month's transactions out of budget
// spend. Same underlying limit account_balances() was already introduced
// to sidestep for balances -- this pages through the raw rows instead,
// firing every page after the first in parallel (once the total count is
// known from that first page) rather than the sequential N round-trips a
// naive loop would need.
async function fetchAllTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  range: { start: string; end: string },
) {
  type Row = {
    user_id: string;
    amount: number;
    currency: string;
    category_id: string | null;
    occurred_at: string;
  };

  const first = await supabase
    .from("transactions")
    .select("user_id, amount, currency, category_id, occurred_at", { count: "exact" })
    .gte("occurred_at", range.start)
    .lte("occurred_at", range.end)
    .order("occurred_at", { ascending: true })
    .range(0, TRANSACTIONS_PAGE_SIZE - 1);
  if (first.error) throw first.error;

  const rows: Row[] = [...(first.data ?? [])];
  const total = first.count ?? rows.length;

  if (total > TRANSACTIONS_PAGE_SIZE) {
    const remainingPages = Math.ceil((total - TRANSACTIONS_PAGE_SIZE) / TRANSACTIONS_PAGE_SIZE);
    const pages = await Promise.all(
      Array.from({ length: remainingPages }, (_, i) => {
        const from = TRANSACTIONS_PAGE_SIZE * (i + 1);
        return supabase
          .from("transactions")
          .select("user_id, amount, currency, category_id, occurred_at")
          .gte("occurred_at", range.start)
          .lte("occurred_at", range.end)
          .order("occurred_at", { ascending: true })
          .range(from, from + TRANSACTIONS_PAGE_SIZE - 1);
      }),
    );
    for (const page of pages) {
      if (page.error) throw page.error;
      rows.push(...(page.data ?? []));
    }
  }

  return rows;
}

export default async function BudgetsPage() {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const supabase = await createClient();

  const monthRange = budgetMonthRange();
  // Widest selectable window in the historical reference dropdown --
  // fetched once, then averageMonthlySavingsByWindow slices it per option
  // (1/3/6/12mo) without a fresh query per dropdown change.
  const trailingRange = trailingMonthsRange(MAX_SAVINGS_WINDOW_MONTHS);
  // Covers both budgets (this month only) and goals (the trailing window) --
  // trailingRange.start is always <= monthRange.start, and monthRange.end
  // (end of this month) is always >= trailingRange.end (today), so one
  // fetch spanning the two bounds satisfies both without either query
  // re-deriving the other's range.
  const fetchRange = { start: trailingRange.start, end: monthRange.end };

  // No .eq("user_id", ...) filter on budgets/goals/transactions below --
  // RLS already returns exactly the right set (each table's own-row
  // policy unioned with its household-member policy), so a plain select
  // picks up a household member's shared budgets/goals and the
  // transactions needed to compute spend against them, without the app
  // re-deriving that same union by hand.
  const [
    [
      { data: accounts },
      { data: categories },
      { data: ownCategories },
      { data: budgets },
      { data: goals },
      { data: members },
      { data: simulationEvents },
    ],
    txRows,
  ] = await Promise.all([
    Promise.all([
      supabase.from("accounts").select("id, user_id, currency").eq("user_id", user.id),
      supabase.from("categories").select("id, name, icon, color, parent_id").order("name"),
      // Own-only -- feeds the Add/Edit budget dialogs' category picker. A
      // budget can only be scoped to a category you own, so a household
      // member's similarly-named categories shouldn't show up as choices.
      supabase
        .from("categories")
        .select("id, name, icon, color, parent_id")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("budgets")
        .select("id, user_id, category_id, amount, currency")
        .order("created_at", { ascending: false }),
      supabase
        .from("goals")
        .select("id, user_id, name, target_amount, target_date, currency, created_at")
        .order("created_at", { ascending: false }),
      household
        ? supabase.from("household_members").select("user_id").eq("household_id", household.id)
        : Promise.resolve({ data: null as { user_id: string }[] | null }),
      supabase
        .from("simulation_events")
        .select("id, user_id, currency, label, amount, occurs_on, category_id, recurrence, recurrence_end")
        .order("occurs_on", { ascending: true }),
    ]),
    fetchAllTransactions(supabase, fetchRange),
  ]);

  // Names for attributing a household member's budget/goal to them --
  // only fetched when there's a household to attribute anything to.
  const memberIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);
  const [{ data: profiles }, { data: memberAccounts }] =
    memberIds.length > 0
      ? await Promise.all([
          supabase.from("profiles").select("id, display_name").in("id", memberIds),
          supabase.from("accounts").select("id, user_id, currency").in("user_id", memberIds),
        ])
      : [
          { data: [] as { id: string; display_name: string | null }[] },
          { data: [] as { id: string; user_id: string; currency: string }[] },
        ];
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "Household member"]),
  );

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const budgetsWithSpend = (budgets ?? []).map((budget) => ({
    ...budget,
    spent: budgetSpent(budget.user_id, budget.category_id, budget.currency, txRows, categoryById, monthRange),
    weeklyBreakdown: weeklyBudgetBreakdown(
      budget.user_id,
      budget.category_id,
      budget.currency,
      txRows,
      categoryById,
      monthRange,
    ),
  }));

  // A goal's progress is the owner's own current balance in the goal's
  // currency -- summed across every account they hold in it, not a
  // hand-kept contribution log. Balances are computed the same way the
  // dashboards already do (account_balances RPC), scoped to the goal
  // owner's accounts (own + visible household members'), so a shared
  // goal shows its real owner's real money, not the viewer's.
  const allAccounts = [...(accounts ?? []), ...(memberAccounts ?? [])];
  const { data: balanceRows } =
    allAccounts.length > 0
      ? await supabase.rpc("account_balances", { target_account_ids: allAccounts.map((a) => a.id) })
      : { data: [] as { account_id: string; user_id: string; currency: string; balance: number }[] };

  const balanceByUserAndCurrency = new Map<string, Map<string, number>>();
  for (const b of balanceRows ?? []) {
    const byCurrency = balanceByUserAndCurrency.get(b.user_id) ?? new Map<string, number>();
    byCurrency.set(b.currency, (byCurrency.get(b.currency) ?? 0) + Number(b.balance));
    balanceByUserAndCurrency.set(b.user_id, byCurrency);
  }

  // Simulation events and expectations are both scoped by (user, currency),
  // not by a specific goal -- a bonus, a big trip, or an income assumption
  // affects every goal sharing that currency identically, same as how
  // progress already draws from one shared account-balance pool per
  // currency rather than per-goal.
  const eventsByUserAndCurrency = new Map<
    string,
    {
      id: string;
      label: string;
      amount: number;
      occurs_on: string;
      category_id: string | null;
      recurrence: RecurrenceKind;
      recurrence_end: string | null;
    }[]
  >();
  for (const e of simulationEvents ?? []) {
    const key = `${e.user_id}::${e.currency}`;
    // The DB column is text + a check constraint, not a real enum, so the
    // Supabase type mirror only knows "string" -- narrowed here, once, at
    // the boundary where it enters the app (the check constraint is what
    // actually guarantees only these four values ever get stored).
    eventsByUserAndCurrency.set(key, [
      ...(eventsByUserAndCurrency.get(key) ?? []),
      { ...e, recurrence: e.recurrence as RecurrenceKind },
    ]);
  }

  const goalsWithProgress = (goals ?? []).map((goal) => {
    const key = `${goal.user_id}::${goal.currency}`;
    return {
      ...goal,
      progress: balanceByUserAndCurrency.get(goal.user_id)?.get(goal.currency) ?? 0,
      // Purely informational (see goal-savings-history.tsx) -- the
      // simulation itself is driven entirely by events, not history.
      savingsByWindow: averageMonthlySavingsByWindow(txRows, goal.user_id, goal.currency),
      events: eventsByUserAndCurrency.get(key) ?? [],
    };
  });

  // Busiest currency among the user's accounts, so the "Add budget/goal"
  // forms default to whatever they mostly use instead of always MAD.
  const currencyCounts = new Map<string, number>();
  for (const a of accounts ?? []) currencyCounts.set(a.currency, (currencyCounts.get(a.currency) ?? 0) + 1);
  const defaultCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "MAD";

  return (
    <BudgetsGoalsTabs
      budgets={budgetsWithSpend}
      goals={goalsWithProgress}
      categories={categories ?? []}
      ownCategories={ownCategories ?? []}
      defaultCurrency={defaultCurrency}
      householdId={household?.id ?? null}
      currentUserId={user.id}
      nameById={nameById}
    />
  );
}
