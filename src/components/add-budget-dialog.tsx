"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { CategoryCombobox } from "@/components/category-combobox";
import { createClient } from "@/lib/supabase/client";
import { budgetExceedsOverallCap } from "@/lib/budgets";
import { formatCurrency } from "@/lib/format";

const OVERALL = "overall";

export function AddBudgetDialog({
  categories,
  defaultCurrency,
  householdId,
  existingBudgets,
}: {
  categories: { id: string; name: string }[];
  defaultCurrency: string;
  householdId: string | null;
  existingBudgets: { category_id: string | null; currency: string; amount: number }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(OVERALL);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategoryId = categoryId === OVERALL ? null : categoryId;
  const numericAmount = Number(amount);

  // One budget per (category-or-overall, currency) is enforced by a unique
  // index (budgets_scope_idx) -- this mirrors that check client-side so the
  // form can refuse to submit instead of round-tripping to find out.
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from("budgets").insert({
      user_id: user.id,
      category_id: effectiveCategoryId,
      amount: numericAmount,
      currency,
    });

    setSaving(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "You already have a budget for this category and currency."
          : insertError.message,
      );
      return;
    }

    setCategoryId(OVERALL);
    setAmount("");
    setCurrency(defaultCurrency);
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add budget</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add budget</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="budget_category">Category</Label>
            <CategoryCombobox
              id="budget_category"
              categories={[{ id: OVERALL, name: "Overall (all spending)" }, ...categories]}
              categoryId={categoryId}
              onCategoryIdChange={(id) => setCategoryId(id ?? OVERALL)}
              placeholder="Overall (all spending)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget_amount">Amount per month</Label>
              <Input
                id="budget_amount"
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
              <Label htmlFor="budget_currency">Currency</Label>
              <Input
                id="budget_currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Budgets reset every month. See how spend lands across the
            month&apos;s weeks from each budget&apos;s &ldquo;Weekly
            breakdown&rdquo;.
            {householdId && " Your household can see this budget, but only you can edit or delete it."}
          </p>
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
          <SheetFooter>
            <Button type="submit" disabled={saving || isDuplicate || exceedsCap}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
