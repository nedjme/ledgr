"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryCombobox } from "@/components/category-combobox";
import { createClient } from "@/lib/supabase/client";
import { budgetExceedsOverallCap } from "@/lib/budgets";
import { formatCurrency } from "@/lib/format";

const OVERALL = "overall";

type EditableBudget = {
  id: string;
  category_id: string | null;
  amount: number;
  currency: string;
};

export function EditBudgetDialog({
  budget,
  categories,
  existingBudgets,
  open,
  onOpenChange,
}: {
  budget: EditableBudget;
  categories: { id: string; name: string }[];
  existingBudgets: { category_id: string | null; currency: string; amount: number }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [categoryId, setCategoryId] = useState<string | null>(budget.category_id ?? OVERALL);
  const [amount, setAmount] = useState(String(budget.amount));
  const [currency, setCurrency] = useState(budget.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategoryId = categoryId === OVERALL ? null : categoryId;
  const numericAmount = Number(amount);

  // Same client-side mirror of budgets_scope_idx as AddBudgetDialog --
  // existingBudgets is the caller's own budgets minus this one, so saving
  // with an unchanged category/currency is never flagged as a duplicate
  // of itself.
  const existingKeys = new Set(
    existingBudgets.map((b) => `${b.category_id ?? OVERALL}::${b.currency.toUpperCase()}`),
  );
  const isDuplicate = existingKeys.has(`${categoryId ?? OVERALL}::${currency.toUpperCase()}`);
  const categoryName =
    categoryId === OVERALL || categoryId === null
      ? "Overall"
      : (categories.find((c) => c.id === categoryId)?.name ?? "this category");
  const exceedsCap =
    !isDuplicate &&
    numericAmount > 0 &&
    budgetExceedsOverallCap(effectiveCategoryId, numericAmount, currency, existingBudgets);
  const sameCurrencyBudgets = existingBudgets.filter(
    (b) => b.currency.toUpperCase() === currency.toUpperCase(),
  );
  const categoryTotal = sameCurrencyBudgets
    .filter((b) => b.category_id !== null)
    .reduce((sum, b) => sum + b.amount, 0);
  const overallAmount = sameCurrencyBudgets.find((b) => b.category_id === null)?.amount;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isDuplicate || exceedsCap) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("budgets")
      .update({
        category_id: effectiveCategoryId,
        amount: numericAmount,
        currency,
      })
      .eq("id", budget.id);

    setSaving(false);
    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "You already have a budget for this category and currency."
          : updateError.message,
      );
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this budget?")) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("budgets").delete().eq("id", budget.id);
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
          <SheetTitle>Edit budget</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit_budget_category">Category</Label>
            <CategoryCombobox
              id="edit_budget_category"
              categories={[{ id: OVERALL, name: "Overall (all spending)" }, ...categories]}
              categoryId={categoryId}
              onCategoryIdChange={(id) => setCategoryId(id ?? OVERALL)}
              placeholder="Overall (all spending)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_budget_amount">Amount per month</Label>
              <Input
                id="edit_budget_amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_budget_currency">Currency</Label>
              <Input
                id="edit_budget_currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
              />
            </div>
          </div>
          {isDuplicate && (
            <p className="text-sm text-destructive">
              You already have a {categoryName} budget in {currency.toUpperCase() || "this currency"}.
            </p>
          )}
          {exceedsCap && effectiveCategoryId === null && (
            <p className="text-sm text-destructive">
              Your category budgets in {currency.toUpperCase()} already total{" "}
              {formatCurrency(categoryTotal, currency)}, more than this Overall amount.
            </p>
          )}
          {exceedsCap && effectiveCategoryId !== null && overallAmount != null && (
            <p className="text-sm text-destructive">
              That would bring your {currency.toUpperCase()} category budgets to{" "}
              {formatCurrency(categoryTotal + numericAmount, currency)}, over your Overall budget of{" "}
              {formatCurrency(overallAmount, currency)}.
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
            <Button type="submit" disabled={saving || isDuplicate || exceedsCap}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
