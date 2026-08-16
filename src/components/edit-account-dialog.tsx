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
import { createClient } from "@/lib/supabase/client";

type EditableAccount = {
  id: string;
  name: string;
  currency: string;
  starting_balance: number;
};

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: EditableAccount;
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
    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        name: form.get("name") as string,
        currency: (form.get("currency") as string) || "MAD",
        starting_balance: Number(form.get("starting_balance")) || 0,
      })
      .eq("id", account.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (
      !confirm(
        "Delete this account? All of its transactions will be deleted too. This can't be undone.",
      )
    ) {
      return;
    }
    setSaving(true);
    const { error: deleteError } = await supabase.from("accounts").delete().eq("id", account.id);
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
          <SheetTitle>Edit account</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit_account_name">Name</Label>
            <Input id="edit_account_name" name="name" defaultValue={account.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_account_currency">Currency</Label>
              <Input
                id="edit_account_currency"
                name="currency"
                defaultValue={account.currency}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_account_starting_balance">Starting balance</Label>
              <Input
                id="edit_account_starting_balance"
                name="starting_balance"
                type="number"
                step="0.01"
                defaultValue={account.starting_balance}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The balance this account had before you started tracking it here.
          </p>
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
