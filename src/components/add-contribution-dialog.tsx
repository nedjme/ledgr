"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

export function AddContributionDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: { id: string; currency: string };
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const type = form.get("type") as string;
    const amount = Number(form.get("amount"));

    const { error: insertError } = await supabase.from("goal_contributions").insert({
      goal_id: goal.id,
      user_id: user.id,
      amount: type === "withdraw" ? -Math.abs(amount) : Math.abs(amount),
      currency: goal.currency,
      occurred_at: (form.get("occurred_at") as string) || new Date().toISOString().slice(0, 10),
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contribution</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contribution_type">Type</Label>
              <Select name="type" defaultValue="add" items={{ add: "Add", withdraw: "Withdraw" }}>
                <SelectTrigger id="contribution_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="withdraw">Withdraw</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contribution_amount">Amount</Label>
              <Input
                id="contribution_amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contribution_date">Date</Label>
            <Input
              id="contribution_date"
              name="occurred_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
