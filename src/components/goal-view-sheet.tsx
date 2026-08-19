"use client";

import { AlertTriangle, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GoalForecastChart } from "@/components/charts/goal-forecast-chart";
import { formatCurrency } from "@/lib/format";
import {
  goalProgress,
  goalPace,
  goalDipInfo,
  simulateCompletionDate,
  goalTimelineSeries,
  resolveSimulationHorizon,
  type RecurrenceKind,
} from "@/lib/goals";
import { cn } from "@/lib/utils";

type ViewableGoal = {
  name: string;
  target_amount: number;
  target_date: string | null;
  currency: string;
  created_at: string;
};

type Event = {
  id: string;
  label: string;
  amount: number;
  occurs_on: string;
  category_id: string | null;
  recurrence: RecurrenceKind;
  recurrence_end: string | null;
};

const PACE_LABEL = {
  "on-track": "On track",
  behind: "Behind pace",
  stalled: "Not on pace",
  "at-risk": "At risk",
};

function formatProjectedDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function GoalViewSheet({
  goal,
  progress,
  events,
  isOwner,
  ownerName,
  open,
  onOpenChange,
  onEdit,
}: {
  goal: ViewableGoal;
  progress: number;
  events: Event[];
  isOwner: boolean;
  ownerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const remaining = Math.max(0, goal.target_amount - progress);
  const pct = goalProgress(goal.target_amount, progress);
  const pace = goalPace(goal.target_amount, progress, events, goal.target_date);
  const projected = simulateCompletionDate(remaining, events);

  const horizon = resolveSimulationHorizon(goal.target_date, events, projected);
  const series = goalTimelineSeries(progress, events, horizon);

  // Separate from the done/at-risk verdict on purpose -- a goal can be
  // "done" (you'll have the target by the deadline) while still dipping
  // below it temporarily along the way, which is worth knowing but isn't a
  // reason to call the goal at risk. Only meaningful with a deadline.
  const targetDateObj = goal.target_date ? new Date(`${goal.target_date}T00:00:00`) : null;
  const dipInfo = targetDateObj ? goalDipInfo(goal.target_amount, progress, events, targetDateObj) : null;

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
                  ) : pace === "behind" ? (
                    <TrendingDown className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  {PACE_LABEL[pace]}
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
              <span className="font-semibold tabular-nums">{formatCurrency(progress, goal.currency)}</span>
              <span className="text-muted-foreground">
                of {formatCurrency(goal.target_amount, goal.currency)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on your current {formatCurrency(progress, goal.currency)} across your {goal.currency}{" "}
              accounts.
            </p>
          </div>

          <GoalForecastChart
            data={series}
            targetAmount={goal.target_amount}
            currency={goal.currency}
            events={events}
          />

          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm">
              {remaining <= 0 ? (
                pace === "at-risk" ? (
                  <span className="text-destructive">
                    You have enough right now, but a planned amount leaves you under target by{" "}
                    {formatProjectedDate(targetDateObj)} -- see the chart above.
                  </span>
                ) : (
                  "You've already reached this goal."
                )
              ) : events.length === 0 ? (
                "Nothing planned yet -- add a recurring income or expense below to see a projection."
              ) : projected ? (
                <>
                  Based on your planned amounts, you&apos;d reach this goal around{" "}
                  <span className="font-medium">{formatProjectedDate(projected)}</span>.
                </>
              ) : (
                "Your planned amounts don't add up to reaching this goal -- try adding a recurring income."
              )}
            </p>
            {dipInfo && pace !== "at-risk" && (
              <p className="text-xs text-muted-foreground">
                Along the way it dips to{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(dipInfo.minBalance, goal.currency)}
                </span>{" "}
                around {formatProjectedDate(dipInfo.minDate)} before recovering by your target date --
                still worth knowing even though you&apos;ll make it.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Driven entirely by your planned {goal.currency} amounts -- manage them from the top of
              the Goals tab.
            </p>
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
