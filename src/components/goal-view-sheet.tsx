"use client";

import { PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { goalProgress, goalPace } from "@/lib/goals";
import { cn } from "@/lib/utils";

type ViewableGoal = {
  name: string;
  target_amount: number;
  target_date: string | null;
  currency: string;
  created_at: string;
};

type Contribution = { id: string; amount: number; occurred_at: string };

export function GoalViewSheet({
  goal,
  contributed,
  contributions,
  isOwner,
  ownerName,
  open,
  onOpenChange,
  onEdit,
  onAddContribution,
}: {
  goal: ViewableGoal;
  contributed: number;
  contributions: Contribution[];
  isOwner: boolean;
  ownerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onAddContribution: () => void;
}) {
  const pct = goalProgress(goal.target_amount, contributed);
  const pace = goal.target_date
    ? goalPace(goal.target_amount, contributed, goal.created_at, goal.target_date)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{goal.name}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PiggyBank className="size-4.5" />
            </span>
            <div>
              {ownerName && <p className="text-sm text-muted-foreground">{ownerName}</p>}
              {pace && pace !== "done" && (
                <p
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    pace === "on-track" ? "text-chart-3" : "text-destructive",
                  )}
                >
                  {pace === "on-track" ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {pace === "on-track" ? "On track" : "Behind pace"}
                </p>
              )}
              {pace === "done" && <p className="text-xs font-medium text-chart-3">Reached</p>}
              {goal.target_date && (
                <p className="text-sm text-muted-foreground">
                  Target: {new Date(`${goal.target_date}T00:00:00`).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold tabular-nums">{formatCurrency(contributed, goal.currency)}</span>
              <span className="text-muted-foreground">
                of {formatCurrency(goal.target_amount, goal.currency)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">History</p>
            {contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contributions yet.</p>
            ) : (
              <div className="space-y-1.5">
                {contributions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {new Date(`${c.occurred_at}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        c.amount < 0 ? "text-destructive" : "text-chart-3",
                      )}
                    >
                      {c.amount < 0 ? "−" : "+"}
                      {formatCurrency(Math.abs(c.amount), goal.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {isOwner && (
          <SheetFooter>
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
            <Button onClick={onAddContribution}>Add contribution</Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
