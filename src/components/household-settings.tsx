"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string | null };
type PendingInvite = { id: string; token: string };

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function HouseholdSettings({
  householdId,
  members,
  pendingInvite,
  currentUserId,
}: {
  householdId: string | null;
  members: Member[];
  pendingInvite: PendingInvite | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState(pendingInvite);

  async function createInvite() {
    setBusy(true);
    setError(null);

    let id = householdId;
    if (!id) {
      const { data, error: rpcError } = await supabase.rpc("create_household", {
        household_name: null,
      });
      if (rpcError) {
        setBusy(false);
        setError(rpcError.message);
        return;
      }
      id = data;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !id) {
      setBusy(false);
      return;
    }

    const token = randomToken();
    const { data: inviteRow, error: insertError } = await supabase
      .from("invites")
      .insert({
        household_id: id,
        token,
        created_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, token")
      .single();

    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setInvite(inviteRow);
    router.refresh();
  }

  async function revokeInvite() {
    if (!invite) return;
    setBusy(true);
    await supabase.from("invites").delete().eq("id", invite.id);
    setBusy(false);
    setInvite(null);
    router.refresh();
  }

  async function leaveHousehold() {
    if (!householdId) return;
    if (!confirm("Leave this household? The joint dashboard will no longer include your transactions.")) {
      return;
    }
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("household_members")
        .delete()
        .eq("household_id", householdId)
        .eq("user_id", user.id);
    }
    setBusy(false);
    router.refresh();
  }

  const inviteUrl = invite && typeof window !== "undefined"
    ? `${window.location.origin}/invite/${invite.token}`
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              It&apos;s just you so far.
            </p>
          ) : (
            members.map((m) => (
              <p key={m.id} className="text-sm">
                {m.display_name ?? "Unnamed"}
                {m.id === currentUserId && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </p>
            ))
          )}
          {members.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Each person edits their own name under &quot;Your profile.&quot;
            </p>
          )}
          {householdId && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={leaveHousehold}
              className="mt-2"
            >
              Leave household
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite partner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invite && inviteUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(inviteUrl)}
                >
                  Copy
                </Button>
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={revokeInvite}>
                Revoke link
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={createInvite}>
              {busy ? "Generating..." : "Generate invite link"}
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
