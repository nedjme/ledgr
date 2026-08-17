"use client";

import { Wallet } from "lucide-react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BudgetWeeklyChart } from "@/components/charts/budget-weekly-chart";
import { formatCurrency } from "@/lib/format";
import { budgetMonthLabel, type WeekBucket } from "@/lib/budgets";
import { categoryColor } from "@/lib/category-color";
import { categoryIconComponent } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

type BudgetCategory = { id: string; name: string; icon: string | null; color: string | null };

export function BudgetViewSheet({
  budget,
  category,
  spent,
  weeklyBreakdown,
  isOwner,
  ownerName,
  open,
  onOpenChange,
  onEdit,
}: {
  budget: { amount: number; currency: string };
  category: BudgetCategory | null;
  spent: number;
  weeklyBreakdown: WeekBucket[];
  isOwner: boolean;
  ownerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const pct = Math.min(100, (spent / budget.amount) * 100);
  const over = spent > budget.amount;
  const color = category ? categoryColor(category.id, category.color) : "var(--primary)";
  const Icon = category?.icon ? categoryIconComponent(category.icon) : null;
  const name = category?.name ?? "Overall";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto">
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
            <p className="text-sm text-muted-foreground">
              {budgetMonthLabel()}
              {ownerName && ` · ${ownerName}`}
            </p>
          </div>

          <div className="space-y-2">
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
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Weekly breakdown</p>
            <BudgetWeeklyChart
              data={weeklyBreakdown}
              budgetAmount={budget.amount}
              currency={budget.currency}
              color={color}
            />
          </div>
        </div>
        {isOwner && (
          <SheetFooter>
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
