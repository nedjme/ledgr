"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category } from "@/lib/supabase/types";

export function AddTransactionDialog({
  accounts,
  categories,
  householdId,
}: {
  accounts: Pick<Account, "id" | "name" | "currency">[];
  categories: Pick<Category, "id" | "name">[];
  householdId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const type = form.get("type") as string;
    const amount = Number(form.get("amount"));

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const accountId = form.get("account_id") as string;
    const currency = accounts.find((a) => a.id === accountId)?.currency ?? "MAD";

    const { error: insertError } = await supabase.from("transactions").insert({
      account_id: accountId,
      category_id: (form.get("category_id") as string) || null,
      user_id: user.id,
      household_id: householdId,
      amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
      currency,
      description: (form.get("description") as string) || null,
      occurred_at: form.get("occurred_at") as string,
      source: "manual",
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryItems = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  if (accounts.length === 0) {
    return (
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/accounts" />}
      >
        Add an account to get started
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add transaction</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                name="type"
                defaultValue="expense"
                items={{ expense: "Expense", income: "Income" }}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account_id">Account</Label>
            <Select
              name="account_id"
              defaultValue={accounts[0]?.id}
              items={accountItems}
              required
            >
              <SelectTrigger id="account_id" className="w-full">
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
            <Label htmlFor="category_id">Category</Label>
            <Select name="category_id" items={categoryItems}>
              <SelectTrigger id="category_id" className="w-full">
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="occurred_at">Date</Label>
              <Input
                id="occurred_at"
                name="occurred_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Carrefour" />
            </div>
          </div>

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
