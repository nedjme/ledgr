"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryCombobox } from "@/components/category-combobox";
import { TransactionDatePicker } from "@/components/transaction-date-picker";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { RecurrenceKind } from "@/lib/goals";

const RECURRENCE_LABEL: Record<RecurrenceKind, string> = {
  once: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const OVERALL = "overall";

export function AddSimulationEventDialog({
  currency,
  categories,
  budgets,
}: {
  currency: string;
  categories: { id: string; name: string }[];
  budgets: { category_id: string | null; currency: string; amount: number }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(OVERALL);
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("once");
  const [hasRecurrenceEnd, setHasRecurrenceEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategoryId = categoryId === OVERALL ? null : categoryId;
  const matchingBudget = budgets.find(
    (b) => b.currency.toUpperCase() === currency.toUpperCase() && b.category_id === effectiveCategoryId,
  );
  const numericAmount = Number(amount || 0);
  // Mirrors check_recurring_event_budget_cap (0025) -- a recurring expense
  // can't promise more spending than what's actually budgeted for its
  // category; one-time events and income aren't constrained this way.
  const exceedsBudgetCap =
    recurrence !== "once" && type === "expense" && matchingBudget != null && numericAmount > matchingBudget.amount;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (exceedsBudgetCap) return;
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from("simulation_events").insert({
      user_id: user.id,
      currency,
      label: form.get("label") as string,
      amount: type === "expense" ? -Math.abs(numericAmount) : Math.abs(numericAmount),
      occurs_on: form.get("occurs_on") as string,
      category_id: effectiveCategoryId,
      recurrence,
      recurrence_end: recurrence !== "once" ? (form.get("recurrence_end") as string) || null : null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setType("income");
    setAmount("");
    setCategoryId(OVERALL);
    setRecurrence("once");
    setHasRecurrenceEnd(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" title="Add an event" />}>
        <Plus className="size-4" />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add {currency} event</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="event_label">Label</Label>
            <Input id="event_label" name="label" placeholder="e.g. Yearly bonus" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event_type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as "income" | "expense")}
                items={{ income: "Income", expense: "Expense" }}
              >
                <SelectTrigger id="event_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event_amount">Amount</Label>
              <Input
                id="event_amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event_category">Category</Label>
              <CategoryCombobox
                id="event_category"
                categories={[{ id: OVERALL, name: "Overall" }, ...categories]}
                categoryId={categoryId}
                onCategoryIdChange={(id) => setCategoryId(id ?? OVERALL)}
                placeholder="Overall"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event_recurrence">Repeats</Label>
              <Select
                value={recurrence}
                onValueChange={(v) => v && setRecurrence(v as RecurrenceKind)}
                items={RECURRENCE_LABEL}
              >
                <SelectTrigger id="event_recurrence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RECURRENCE_LABEL) as RecurrenceKind[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event_date">{recurrence === "once" ? "Date" : "Starts"}</Label>
              <TransactionDatePicker id="event_date" name="occurs_on" required />
            </div>
            {recurrence !== "once" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="event_recurrence_end">Ends (optional)</Label>
                  {hasRecurrenceEnd && (
                    <button
                      type="button"
                      onClick={() => setHasRecurrenceEnd(false)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {hasRecurrenceEnd ? (
                  <TransactionDatePicker id="event_recurrence_end" name="recurrence_end" />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 font-normal text-muted-foreground"
                    onClick={() => setHasRecurrenceEnd(true)}
                  >
                    <CalendarDays className="size-4" />
                    Add an end date
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Drives every {currency} goal&apos;s projection -- no history involved, only what you plan
            here.
          </p>
          {exceedsBudgetCap && matchingBudget && (
            <p className="text-sm text-destructive">
              A recurring expense can&apos;t exceed its category&apos;s budget of{" "}
              {formatCurrency(matchingBudget.amount, currency)}.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="submit" disabled={saving || exceedsBudgetCap}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
