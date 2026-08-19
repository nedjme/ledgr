"use client";

import { useState } from "react";
import { AddSimulationEventDialog } from "@/components/add-simulation-event-dialog";
import { EditSimulationEventDialog } from "@/components/edit-simulation-event-dialog";
import { formatCurrency } from "@/lib/format";
import type { RecurrenceKind } from "@/lib/goals";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  label: string;
  amount: number;
  occurs_on: string;
  category_id: string | null;
  category_name: string | null;
  recurrence: RecurrenceKind;
  recurrence_end: string | null;
};

const RECURRENCE_LABEL: Record<RecurrenceKind, string> = {
  once: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function EventRow({
  event,
  currency,
  categories,
  budgets,
  isOwner,
}: {
  event: Event;
  currency: string;
  categories: { id: string; name: string }[];
  budgets: { category_id: string | null; currency: string; amount: number }[];
  isOwner: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div
        role={isOwner ? "button" : undefined}
        tabIndex={isOwner ? 0 : undefined}
        onClick={isOwner ? () => setEditOpen(true) : undefined}
        onKeyDown={
          isOwner
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditOpen(true);
                }
              }
            : undefined
        }
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm transition-colors",
          isOwner &&
            "cursor-pointer outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{event.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {new Date(`${event.occurs_on}T00:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {event.recurrence !== "once" && ` · ${RECURRENCE_LABEL[event.recurrence]}`}
            {event.category_name && ` · ${event.category_name}`}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums",
            event.amount < 0 ? "text-destructive" : "text-chart-3",
          )}
        >
          {event.amount < 0 ? "−" : "+"}
          {formatCurrency(Math.abs(event.amount), currency)}
        </span>
      </div>
      {isOwner && (
        <EditSimulationEventDialog
          event={event}
          currency={currency}
          categories={categories}
          budgets={budgets}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}

export function GoalSimulationEvents({
  currency,
  events,
  categories,
  budgets,
  isOwner,
  ownerName,
}: {
  currency: string;
  events: Event[];
  categories: { id: string; name: string }[];
  budgets: { category_id: string | null; currency: string; amount: number }[];
  isOwner: boolean;
  ownerName?: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {currency} events{ownerName ? ` · ${ownerName}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            One-time or recurring amounts -- applies to every {currency} goal
            {ownerName ? ` of ${ownerName}'s` : ""}.
          </p>
        </div>
        {isOwner && <AddSimulationEventDialog currency={currency} categories={categories} budgets={budgets} />}
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing planned yet.</p>
      ) : (
        <div className="space-y-1">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              currency={currency}
              categories={categories}
              budgets={budgets}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
