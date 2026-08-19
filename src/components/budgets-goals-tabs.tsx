"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AddBudgetDialog } from "@/components/add-budget-dialog";
import { AddGoalDialog } from "@/components/add-goal-dialog";
import { BudgetCard } from "@/components/budget-card";
import { GoalCard } from "@/components/goal-card";
import type { WeekBucket } from "@/lib/budgets";

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
  contributed: number;
  contributions: { id: string; amount: number; occurred_at: string }[];
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
  const [tab, setTab] = useState("budgets");
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

  return (
    <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
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

      <TabsContent value="goals" className="mt-6">
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
                contributed={goal.contributed}
                contributions={goal.contributions}
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
