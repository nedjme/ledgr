"use client";

import { useState } from "react";
import { AlertTriangle, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EditGoalDialog } from "@/components/edit-goal-dialog";
import { GoalViewSheet } from "@/components/goal-view-sheet";
import { formatCurrency } from "@/lib/format";
import { goalProgress, goalPace, type RecurrenceKind } from "@/lib/goals";
import { cn } from "@/lib/utils";

type EditableGoal = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  currency: string;
  created_at: string;
};

const PACE_LABEL = {
  "on-track": "On track",
  behind: "Behind pace",
  stalled: "Not on pace",
  "at-risk": "At risk",
};

export function GoalCard({
  goal,
  progress,
  events,
  isOwner,
  ownerName,
}: {
  goal: EditableGoal;
  progress: number;
  events: {
    id: string;
    label: string;
    amount: number;
    occurs_on: string;
    category_id: string | null;
    recurrence: RecurrenceKind;
    recurrence_end: string | null;
  }[];
  isOwner: boolean;
  ownerName: string | null;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const pct = goalProgress(goal.target_amount, progress);
  const pace = goalPace(goal.target_amount, progress, events, goal.target_date);

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
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PiggyBank className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{goal.name}</p>
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
                  ) : pace === "behind" ? (
                    <TrendingDown className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  {PACE_LABEL[pace]}
                </p>
              )}
              {pace === "done" && <p className="text-xs font-medium text-chart-3">Reached</p>}
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold tabular-nums">{formatCurrency(progress, goal.currency)}</span>
            <span className="text-muted-foreground">
              of {formatCurrency(goal.target_amount, goal.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      <GoalViewSheet
        goal={goal}
        progress={progress}
        events={events}
        isOwner={isOwner}
        ownerName={ownerName}
        open={viewOpen}
        onOpenChange={setViewOpen}
        onEdit={() => {
          setViewOpen(false);
          setEditOpen(true);
        }}
      />
      {isOwner && <EditGoalDialog goal={goal} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  );
}
