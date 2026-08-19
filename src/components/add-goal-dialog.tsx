"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
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
import { TransactionDatePicker } from "@/components/transaction-date-picker";
import { createClient } from "@/lib/supabase/client";

export function AddGoalDialog({
  defaultCurrency,
  householdId,
}: {
  defaultCurrency: string;
  householdId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [hasTargetDate, setHasTargetDate] = useState(false);
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

    const { error: insertError } = await supabase.from("goals").insert({
      user_id: user.id,
      name: form.get("name") as string,
      target_amount: Number(form.get("target_amount")),
      target_date: (form.get("target_date") as string) || null,
      currency: (form.get("currency") as string) || defaultCurrency,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setHasTargetDate(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>Add goal</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add goal</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="goal_name">Name</Label>
            <Input id="goal_name" name="name" placeholder="e.g. Emergency fund" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal_target_amount">Target amount</Label>
              <Input
                id="goal_target_amount"
                name="target_amount"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal_currency">Currency</Label>
              <Input id="goal_currency" name="currency" defaultValue={defaultCurrency} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal_target_date">Target date (optional)</Label>
              {hasTargetDate && (
                <button
                  type="button"
                  onClick={() => setHasTargetDate(false)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            {hasTargetDate ? (
              <TransactionDatePicker id="goal_target_date" name="target_date" />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 font-normal text-muted-foreground"
                onClick={() => setHasTargetDate(true)}
              >
                <CalendarDays className="size-4" />
                Add a target date
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Progress comes from your real account balances and spending --
            add a target date to see whether you&apos;re on pace to reach it in
            time.
            {householdId && " Your household can see this goal, but only you can edit it."}
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
