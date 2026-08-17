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
  defaultCurrency,
  householdId,
  currentUserId,
  nameById,
}: {
  budgets: BudgetWithSpend[];
  goals: GoalWithProgress[];
  categories: BudgetCategory[];
  defaultCurrency: string;
  householdId: string | null;
  currentUserId: string;
  nameById: Map<string, string>;
}) {
  const [tab, setTab] = useState("budgets");
  // Budgets can only be scoped to a top-level category -- its spend already
  // rolls up subcategory totals, so a subcategory-specific budget would
  // just double-count against its parent's.
  const topLevelCategories = categories.filter((c) => c.parent_id === null);
  const categoryById = new Map(topLevelCategories.map((c) => [c.id, c]));

  return (
    <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        {tab === "budgets" ? (
          <AddBudgetDialog
            categories={topLevelCategories}
            defaultCurrency={defaultCurrency}
            householdId={householdId}
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
                categories={topLevelCategories}
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
