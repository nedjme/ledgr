"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EditTransactionDialog } from "@/components/edit-transaction-dialog";

export type TransactionRow = {
  id: string;
  account_id: string;
  category_id: string | null;
  user_id: string;
  occurred_at: string;
  description: string | null;
  amount: number;
  currency: string;
  category_name: string | null;
  owner_name?: string | null;
};

type EditableContext = {
  currentUserId: string;
  accounts: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string }[];
};

function formatDayHeading(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TransactionRowItem({
  row,
  showOwner,
  editable,
}: {
  row: TransactionRow;
  showOwner: boolean;
  editable: EditableContext | null;
}) {
  const [open, setOpen] = useState(false);
  const isIncome = row.amount > 0;
  const canEdit = editable != null && row.user_id === editable.currentUserId;

  return (
    <>
      <div
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? () => setOpen(true) : undefined}
        onKeyDown={
          canEdit
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }
            : undefined
        }
        className={cn(
          "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60",
          canEdit && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            isIncome ? "bg-chart-3/15 text-chart-3" : "bg-muted text-muted-foreground",
          )}
        >
          {isIncome ? (
            <ArrowDownLeft className="size-4.5" />
          ) : (
            <ArrowUpRight className="size-4.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.description || "Untitled"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.category_name ?? "Uncategorized"}
            {showOwner && row.owner_name ? ` · ${row.owner_name}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            isIncome ? "text-chart-3" : "text-foreground",
          )}
        >
          {isIncome ? "+" : ""}
          {formatCurrency(row.amount, row.currency)}
        </span>
      </div>

      {canEdit && editable && (
        <EditTransactionDialog
          transaction={row}
          accounts={editable.accounts}
          categories={editable.categories}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

export function TransactionList({
  rows,
  showOwner = false,
  editable = null,
}: {
  rows: TransactionRow[];
  showOwner?: boolean;
  editable?: EditableContext | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions yet.
      </p>
    );
  }

  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const key = row.occurred_at;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([day, dayRows]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {formatDayHeading(day)}
          </p>
          <div className="space-y-1">
            {dayRows.map((row) => (
              <TransactionRowItem
                key={row.id}
                row={row}
                showOwner={showOwner}
                editable={editable}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
