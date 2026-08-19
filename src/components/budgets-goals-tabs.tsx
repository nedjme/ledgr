"use client";

import { useOptimisticParams } from "@/lib/use-optimistic-params";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AddBudgetDialog } from "@/components/add-budget-dialog";
import { AddGoalDialog } from "@/components/add-goal-dialog";
import { BudgetCard } from "@/components/budget-card";
import { GoalCard } from "@/components/goal-card";
import { GoalSimulationEvents } from "@/components/goal-simulation-events";
import { GoalSavingsHistory } from "@/components/goal-savings-history";
import type { WeekBucket } from "@/lib/budgets";
import type { RecurrenceKind } from "@/lib/goals";

type BudgetCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
};

type BudgetWithSpend = {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  spent: number;
  weeklyBreakdown: WeekBucket[];
};

type GoalWithProgress = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  currency: string;
  created_at: string;
  progress: number;
  savingsByWindow: { months: number; income: number; spend: number; net: number }[];
  events: {
    id: string;
    label: string;
    amount: number;
    occurs_on: string;
    category_id: string | null;
    recurrence: RecurrenceKind;
    recurrence_end: string | null;
  }[];
};

export function BudgetsGoalsTabs({
  budgets,
  goals,
  categories,
  ownCategories,
  defaultCurrency,
  householdId,
  currentUserId,
  nameById,
}: {
  budgets: BudgetWithSpend[];
  goals: GoalWithProgress[];
  categories: BudgetCategory[];
  ownCategories: BudgetCategory[];
  defaultCurrency: string;
  householdId: string | null;
  currentUserId: string;
  nameById: Map<string, string>;
}) {
  // Kept in the URL (not local state) so a refresh -- or a link straight to
  // the Goals tab -- lands you back where you were instead of always
  // reverting to Budgets. `shallow: true` because switching tabs doesn't
  // need any new data from the server -- both tabs' content is already
  // loaded -- so there's no reason to pay for a full navigation just to
  // flip which one is visible.
  const { params, navigate } = useOptimisticParams();
  const tab = params.tab === "goals" ? "goals" : "budgets";
  function handleTabChange(v: string | null) {
    if (!v) return;
    navigate((p) => p.set("tab", v), { shallow: true });
  }
  // Budgets can only be scoped to a top-level category -- its spend already
  // rolls up subcategory totals, so a subcategory-specific budget would
  // just double-count against its parent's. `categories` (own + a
  // household member's, read-only) resolves every shown budget's label;
  // `ownCategories` is the narrower list offered as picker choices, since
  // a budget can only be scoped to a category you own.
  const topLevelOwnCategories = ownCategories.filter((c) => c.parent_id === null);
  // Built from every category, not just topLevelCategories -- a budget's
  // category can end up nested under a new parent after the budget was
  // created (see budgetSpent's own comment), and this is only used to
  // resolve a budget's existing category_id to a label/icon/color, not to
  // offer new picker choices, so it needs to find it either way.
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // The uniqueness constraint (one budget per category-or-overall, per
  // currency) is scoped per user, so a household member's own budgets never
  // block or get blocked by yours -- only your own count here.
  const ownBudgets = budgets.filter((b) => b.user_id === currentUserId);

  // Simulation events and the savings assumption are both scoped by
  // (owner, currency), not by a specific goal -- shown once per distinct
  // pair here instead of once per goal, so adding a bonus or setting an
  // income assumption doesn't mean re-adding it under every goal that
  // happens to share the currency. One representative goal per pair
  // carries the right values already (see budgets/page.tsx).
  type SimulationGroup = {
    userId: string;
    currency: string;
    events: GoalWithProgress["events"];
    savingsByWindow: GoalWithProgress["savingsByWindow"];
  };
  const simulationGroups = new Map<string, SimulationGroup>();
  for (const goal of goals) {
    const key = `${goal.user_id}::${goal.currency}`;
    if (!simulationGroups.has(key)) {
      simulationGroups.set(key, {
        userId: goal.user_id,
        currency: goal.currency,
        events: goal.events,
        savingsByWindow: goal.savingsByWindow,
      });
    }
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        {tab === "budgets" ? (
          <AddBudgetDialog
            categories={topLevelOwnCategories}
            defaultCurrency={defaultCurrency}
            householdId={householdId}
            existingBudgets={ownBudgets}
          />
        ) : (
          <AddGoalDialog defaultCurrency={defaultCurrency} householdId={householdId} />
        )}
      </div>

      <TabsContent value="budgets" className="mt-6">
        {budgets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No budgets yet. Add one to start tracking spending against a limit.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                category={budget.category_id ? (categoryById.get(budget.category_id) ?? null) : null}
                spent={budget.spent}
                weeklyBreakdown={budget.weeklyBreakdown}
                categories={topLevelOwnCategories}
                existingBudgets={ownBudgets.filter((b) => b.id !== budget.id)}
                isOwner={budget.user_id === currentUserId}
                ownerName={budget.user_id === currentUserId ? null : (nameById.get(budget.user_id) ?? null)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="goals" className="mt-6 space-y-6">
        {simulationGroups.size > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[...simulationGroups.values()].map((group) => (
              <Card key={`${group.userId}::${group.currency}`}>
                <CardContent className="space-y-5">
                  <GoalSavingsHistory
                    currency={group.currency}
                    savingsByWindow={group.savingsByWindow}
                    ownerName={group.userId === currentUserId ? null : (nameById.get(group.userId) ?? null)}
                  />
                  <div className="border-t border-border pt-4">
                    <GoalSimulationEvents
                      currency={group.currency}
                      events={group.events.map((ev) => ({
                        ...ev,
                        category_name: ev.category_id ? (categoryById.get(ev.category_id)?.name ?? null) : null,
                      }))}
                      categories={topLevelOwnCategories}
                      budgets={ownBudgets}
                      isOwner={group.userId === currentUserId}
                      ownerName={group.userId === currentUserId ? null : (nameById.get(group.userId) ?? null)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No goals yet. Add one to start tracking progress toward it.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={goal.progress}
                events={goal.events}
                isOwner={goal.user_id === currentUserId}
                ownerName={goal.user_id === currentUserId ? null : (nameById.get(goal.user_id) ?? null)}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
