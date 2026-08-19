"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { SAVINGS_TRAILING_MONTHS, SAVINGS_WINDOW_OPTIONS } from "@/lib/goals";

type WindowAverage = { months: number; income: number; spend: number; net: number };

// Purely informational -- the simulation itself always drives off the real
// historical average (SAVINGS_TRAILING_MONTHS), not a manually-set number.
// A separate "expected income/spend" override used to exist here, but it
// overlapped awkwardly with recurring simulation_events once those
// shipped: the historical average already reflects your current rent, so
// a recurring "Rent" event added on top of an override that was itself
// usually just a copy of that same average risked double-counting it.
export function GoalSavingsHistory({
  currency,
  savingsByWindow,
  ownerName,
}: {
  currency: string;
  savingsByWindow: WindowAverage[];
  ownerName?: string | null;
}) {
  const [windowMonths, setWindowMonths] = useState(String(SAVINGS_TRAILING_MONTHS));

  const selected = savingsByWindow.find((w) => w.months === Number(windowMonths)) ?? savingsByWindow[0];
  const windowItems = Object.fromEntries(
    SAVINGS_WINDOW_OPTIONS.map((m) => [String(m), m === 1 ? "Last month" : `Last ${m} months`]),
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">
          {currency} history{ownerName ? ` · ${ownerName}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Drives every {currency} goal&apos;s projection, bent around planned amounts below.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
        <Select value={windowMonths} onValueChange={(v) => v && setWindowMonths(v)} items={windowItems}>
          <SelectTrigger className="h-7 w-auto border-none bg-transparent text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SAVINGS_WINDOW_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m === 1 ? "Last month" : `Last ${m} months`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selected ? (
            <>
              {formatCurrency(selected.income, currency)} in · {formatCurrency(selected.spend, currency)} out
            </>
          ) : (
            "No history yet"
          )}
        </p>
      </div>
    </div>
  );
}
