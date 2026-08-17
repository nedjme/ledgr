"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryCombobox } from "@/components/category-combobox";
import { createClient } from "@/lib/supabase/client";

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
  open,
  onOpenChange,
}: {
  budget: EditableBudget;
  categories: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [categoryId, setCategoryId] = useState<string | null>(budget.category_id ?? OVERALL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const { error: updateError } = await supabase
      .from("budgets")
      .update({
        category_id: categoryId === OVERALL ? null : categoryId,
        amount: Number(form.get("amount")),
        currency: form.get("currency") as string,
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
                defaultValue={budget.amount}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_budget_currency">Currency</Label>
              <Input
                id="edit_budget_currency"
                name="currency"
                defaultValue={budget.currency}
                required
              />
            </div>
          </div>
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
