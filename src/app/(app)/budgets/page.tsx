import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { BudgetsGoalsTabs } from "@/components/budgets-goals-tabs";
import { budgetMonthRange, budgetSpent, weeklyBudgetBreakdown } from "@/lib/budgets";

export default async function BudgetsPage() {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const supabase = await createClient();

  const monthRange = budgetMonthRange();

  // No .eq("user_id", ...) filter on budgets/goals/transactions below --
  // RLS already returns exactly the right set (each table's own-row
  // policy unioned with its household-member policy), so a plain select
  // picks up a household member's shared budgets/goals and the
  // transactions needed to compute spend against them, without the app
  // re-deriving that same union by hand.
  const [
    { data: accounts },
    { data: categories },
    { data: ownCategories },
    { data: budgets },
    { data: goals },
    { data: transactions },
    { data: members },
  ] = await Promise.all([
    supabase.from("accounts").select("currency").eq("user_id", user.id),
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
    supabase
      .from("transactions")
      .select("user_id, amount, currency, category_id, occurred_at")
      .gte("occurred_at", monthRange.start)
      .lte("occurred_at", monthRange.end),
    household
      ? supabase.from("household_members").select("user_id").eq("household_id", household.id)
      : Promise.resolve({ data: null as { user_id: string }[] | null }),
  ]);

  // Names for attributing a household member's budget/goal to them --
  // only fetched when there's a household to attribute anything to.
  const memberIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);
  const { data: profiles } =
    memberIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
      : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "Household member"]),
  );

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const txRows = transactions ?? [];

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

  const goalIds = (goals ?? []).map((g) => g.id);
  const { data: contributions } =
    goalIds.length > 0
      ? await supabase
          .from("goal_contributions")
          .select("id, goal_id, amount, occurred_at")
          .in("goal_id", goalIds)
          .order("occurred_at", { ascending: false })
      : { data: [] as { id: string; goal_id: string; amount: number; occurred_at: string }[] };

  const contributedByGoal = new Map<string, number>();
  const contributionsByGoal = new Map<string, { id: string; amount: number; occurred_at: string }[]>();
  for (const c of contributions ?? []) {
    contributedByGoal.set(c.goal_id, (contributedByGoal.get(c.goal_id) ?? 0) + c.amount);
    contributionsByGoal.set(c.goal_id, [...(contributionsByGoal.get(c.goal_id) ?? []), c]);
  }
  const goalsWithProgress = (goals ?? []).map((goal) => ({
    ...goal,
    contributed: contributedByGoal.get(goal.id) ?? 0,
    contributions: contributionsByGoal.get(goal.id) ?? [],
  }));

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
