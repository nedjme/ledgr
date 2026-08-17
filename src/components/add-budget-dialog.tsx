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

const OVERALL = "overall";

export function AddBudgetDialog({
  categories,
  defaultCurrency,
  householdId,
}: {
  categories: { id: string; name: string }[];
  defaultCurrency: string;
  householdId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(OVERALL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from("budgets").insert({
      user_id: user.id,
      category_id: categoryId === OVERALL ? null : categoryId,
      amount: Number(form.get("amount")),
      currency: (form.get("currency") as string) || defaultCurrency,
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
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget_currency">Currency</Label>
              <Input id="budget_currency" name="currency" defaultValue={defaultCurrency} required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Budgets reset every month. See how spend lands across the
            month&apos;s weeks from each budget&apos;s &ldquo;Weekly
            breakdown&rdquo;.
            {householdId && " Your household can see this budget, but only you can edit or delete it."}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
