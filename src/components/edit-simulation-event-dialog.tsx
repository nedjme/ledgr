"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

type EditableEvent = {
  id: string;
  label: string;
  amount: number;
  occurs_on: string;
  category_id: string | null;
  recurrence: RecurrenceKind;
  recurrence_end: string | null;
};

export function EditSimulationEventDialog({
  event,
  currency,
  categories,
  budgets,
  open,
  onOpenChange,
}: {
  event: EditableEvent;
  currency: string;
  categories: { id: string; name: string }[];
  budgets: { category_id: string | null; currency: string; amount: number }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [type, setType] = useState<"income" | "expense">(event.amount < 0 ? "expense" : "income");
  const [amount, setAmount] = useState(String(Math.abs(event.amount)));
  const [categoryId, setCategoryId] = useState<string | null>(event.category_id ?? OVERALL);
  const [recurrence, setRecurrence] = useState<RecurrenceKind>(event.recurrence);
  const [hasRecurrenceEnd, setHasRecurrenceEnd] = useState(event.recurrence_end !== null);
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
    const { error: updateError } = await supabase
      .from("simulation_events")
      .update({
        label: form.get("label") as string,
        amount: type === "expense" ? -Math.abs(numericAmount) : Math.abs(numericAmount),
        occurs_on: form.get("occurs_on") as string,
        category_id: effectiveCategoryId,
        recurrence,
        recurrence_end: recurrence !== "once" ? (form.get("recurrence_end") as string) || null : null,
      })
      .eq("id", event.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this event?")) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("simulation_events").delete().eq("id", event.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit {currency} event</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit_event_label">Label</Label>
            <Input id="edit_event_label" name="label" defaultValue={event.label} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_event_type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as "income" | "expense")}
                items={{ income: "Income", expense: "Expense" }}
              >
                <SelectTrigger id="edit_event_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_event_amount">Amount</Label>
              <Input
                id="edit_event_amount"
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
              <Label htmlFor="edit_event_category">Category</Label>
              <CategoryCombobox
                id="edit_event_category"
                categories={[{ id: OVERALL, name: "Overall" }, ...categories]}
                categoryId={categoryId}
                onCategoryIdChange={(id) => setCategoryId(id ?? OVERALL)}
                placeholder="Overall"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_event_recurrence">Repeats</Label>
              <Select
                value={recurrence}
                onValueChange={(v) => v && setRecurrence(v as RecurrenceKind)}
                items={RECURRENCE_LABEL}
              >
                <SelectTrigger id="edit_event_recurrence" className="w-full">
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
              <Label htmlFor="edit_event_date">{recurrence === "once" ? "Date" : "Starts"}</Label>
              <TransactionDatePicker id="edit_event_date" name="occurs_on" defaultValue={event.occurs_on} required />
            </div>
            {recurrence !== "once" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit_event_recurrence_end">Ends (optional)</Label>
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
                  <TransactionDatePicker
                    id="edit_event_recurrence_end"
                    name="recurrence_end"
                    defaultValue={event.recurrence_end ?? undefined}
                  />
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
          {exceedsBudgetCap && matchingBudget && (
            <p className="text-sm text-destructive">
              A recurring expense can&apos;t exceed its category&apos;s budget of{" "}
              {formatCurrency(matchingBudget.amount, currency)}.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={saving}
            >
              Delete
            </Button>
            <Button type="submit" disabled={saving || exceedsBudgetCap}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
