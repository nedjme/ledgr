"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [backfill, setBackfill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setBusy(true);
    setError(null);

    const { data: newHouseholdId, error: rpcError } = await supabase.rpc(
      "accept_invite",
      { invite_token: token },
    );

    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }

    if (backfill && newHouseholdId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("transactions")
          .update({ household_id: newHouseholdId })
          .eq("user_id", user.id);
      }
    }

    router.push("/dashboard/household");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="backfill"
          checked={backfill}
          onCheckedChange={(v) => setBackfill(v === true)}
        />
        <Label htmlFor="backfill" className="font-normal text-sm leading-snug">
          Include my existing transaction history in the joint dashboard
        </Label>
      </div>
      <Button onClick={onAccept} disabled={busy} className="w-full">
        {busy ? "Joining..." : "Join household"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
