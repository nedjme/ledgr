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
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryCombobox } from "@/components/category-combobox";
import { TransactionDatePicker } from "@/components/transaction-date-picker";
import { createClient } from "@/lib/supabase/client";

type EditableTransaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  occurred_at: string;
};

export function EditTransactionDialog({
  transaction,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  transaction: EditableTransaction;
  accounts: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const type = form.get("type") as string;
    const amount = Number(form.get("amount"));
    const accountId = form.get("account_id") as string;
    const currency = accounts.find((a) => a.id === accountId)?.currency ?? "MAD";

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        account_id: accountId,
        category_id: (form.get("category_id") as string) || null,
        amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
        currency,
        description: (form.get("description") as string) || null,
        occurred_at: form.get("occurred_at") as string,
      })
      .eq("id", transaction.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this transaction? This can't be undone.")) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit transaction</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_type">Type</Label>
              <Select
                name="type"
                defaultValue={transaction.amount < 0 ? "expense" : "income"}
                items={{ expense: "Expense", income: "Income" }}
              >
                <SelectTrigger id="edit_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_amount">Amount</Label>
              <Input
                id="edit_amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={Math.abs(transaction.amount)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit_account_id">Account</Label>
            <Select
              name="account_id"
              defaultValue={transaction.account_id}
              items={accountItems}
              required
            >
              <SelectTrigger id="edit_account_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit_category_id">Category</Label>
            <CategoryCombobox
              id="edit_category_id"
              name="category_id"
              categories={categories}
              defaultCategoryId={transaction.category_id}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_occurred_at">Date</Label>
              <TransactionDatePicker
                id="edit_occurred_at"
                name="occurred_at"
                defaultValue={transaction.occurred_at}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_description">Description</Label>
              <Input
                id="edit_description"
                name="description"
                defaultValue={transaction.description ?? ""}
                placeholder="Carrefour"
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
