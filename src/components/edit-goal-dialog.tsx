"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TransactionDatePicker } from "@/components/transaction-date-picker";
import { createClient } from "@/lib/supabase/client";

type EditableGoal = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  currency: string;
};

export function EditGoalDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: EditableGoal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [hasTargetDate, setHasTargetDate] = useState(goal.target_date !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const { error: updateError } = await supabase
      .from("goals")
      .update({
        name: form.get("name") as string,
        target_amount: Number(form.get("target_amount")),
        target_date: (form.get("target_date") as string) || null,
        currency: form.get("currency") as string,
      })
      .eq("id", goal.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this goal?")) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("goals").delete().eq("id", goal.id);
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
          <SheetTitle>Edit goal</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit_goal_name">Name</Label>
            <Input id="edit_goal_name" name="name" defaultValue={goal.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_goal_target_amount">Target amount</Label>
              <Input
                id="edit_goal_target_amount"
                name="target_amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={goal.target_amount}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_goal_currency">Currency</Label>
              <Input id="edit_goal_currency" name="currency" defaultValue={goal.currency} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit_goal_target_date">Target date (optional)</Label>
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
              <TransactionDatePicker
                id="edit_goal_target_date"
                name="target_date"
                defaultValue={goal.target_date ?? undefined}
              />
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
