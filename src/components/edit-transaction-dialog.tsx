"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  description: string | null;
  description_key: string | null;
  amount: number;
  occurred_at: string;
};

export function EditTransactionDialog({
  transaction,
  currentUserId,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  transaction: EditableTransaction;
  currentUserId: string;
  accounts: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [similarCount, setSimilarCount] = useState<number | null>(null);

  const categoryChanged = categoryId !== transaction.category_id && categoryId !== null;

  // Only relevant once the category actually changed to something new --
  // counts other transactions sharing this one's normalized description, so
  // the checkbox can say "and N other 'carrefour' transactions" instead of
  // asking blind. description_key is null for a blank/all-numeric
  // description, which has nothing meaningful to group by.
  useEffect(() => {
    if (!open || !categoryChanged || !transaction.description_key) return;
    let cancelled = false;
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .eq("description_key", transaction.description_key)
      .neq("id", transaction.id)
      .then(({ count }) => {
        if (!cancelled) setSimilarCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [open, categoryChanged, transaction.description_key, transaction.id, currentUserId, supabase]);

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
        category_id: categoryId,
        amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
        currency,
        description: (form.get("description") as string) || null,
        occurred_at: form.get("occurred_at") as string,
      })
      .eq("id", transaction.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // Bulk-apply + remember as one action, only once the category actually
    // changed and the user opted in -- a no-op edit to amount/date/etc.
    // shouldn't silently sweep this category across every similar
    // transaction.
    if (applyToSimilar && categoryChanged && categoryId) {
      const { error: rpcError } = await supabase.rpc("apply_category_to_similar", {
        p_transaction_id: transaction.id,
        p_category_id: categoryId,
        p_remember: true,
      });
      if (rpcError) {
        setSaving(false);
        setError(rpcError.message);
        return;
      }
    }

    setSaving(false);
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
              categories={categories}
              categoryId={categoryId}
              onCategoryIdChange={setCategoryId}
            />
          </div>

          {categoryChanged && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <Checkbox
                checked={applyToSimilar}
                onCheckedChange={(checked) => setApplyToSimilar(checked === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                {similarCount ? (
                  <>
                    Apply to <span className="font-medium text-foreground">{similarCount}</span> other
                    similar transaction{similarCount === 1 ? "" : "s"}, and remember this for future
                    imports.
                  </>
                ) : (
                  "Remember this category for similar transactions in the future."
                )}
              </span>
            </label>
          )}

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
