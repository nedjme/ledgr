"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EditBudgetDialog } from "@/components/edit-budget-dialog";
import { BudgetViewSheet } from "@/components/budget-view-sheet";
import { formatCurrency } from "@/lib/format";
import { budgetMonthLabel, type WeekBucket } from "@/lib/budgets";
import { categoryColor } from "@/lib/category-color";
import { categoryIconComponent } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

type BudgetCategory = { id: string; name: string; icon: string | null; color: string | null };

export function BudgetCard({
  budget,
  category,
  spent,
  weeklyBreakdown,
  categories,
  isOwner,
  ownerName,
}: {
  budget: { id: string; category_id: string | null; amount: number; currency: string };
  category: BudgetCategory | null;
  spent: number;
  weeklyBreakdown: WeekBucket[];
  categories: BudgetCategory[];
  isOwner: boolean;
  ownerName: string | null;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const pct = Math.min(100, (spent / budget.amount) * 100);
  const over = spent > budget.amount;
  const color = category ? categoryColor(category.id, category.color) : "var(--primary)";
  const Icon = category?.icon ? categoryIconComponent(category.icon) : null;
  const name = category?.name ?? "Overall";

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setViewOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setViewOpen(true);
          }
        }}
        className="cursor-pointer transition-colors hover:bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: category ? color : "var(--primary)" }}
            >
              {Icon ? (
                // eslint-disable-next-line react-hooks/static-components -- stable lookup from a static registry
                <Icon className="size-4.5" />
              ) : (
                <Wallet className="size-4.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">
                {budgetMonthLabel()}
                {ownerName && ` · ${ownerName}`}
              </p>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-baseline justify-between text-sm">
            <span className={cn("font-semibold tabular-nums", over && "text-destructive")}>
              {formatCurrency(spent, budget.currency)}
            </span>
            <span className="text-muted-foreground">
              of {formatCurrency(budget.amount, budget.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      <BudgetViewSheet
        budget={budget}
        category={category}
        spent={spent}
        weeklyBreakdown={weeklyBreakdown}
        isOwner={isOwner}
        ownerName={ownerName}
        open={viewOpen}
        onOpenChange={setViewOpen}
        onEdit={() => {
          setViewOpen(false);
          setEditOpen(true);
        }}
      />
      {isOwner && (
        <EditBudgetDialog budget={budget} categories={categories} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
}
