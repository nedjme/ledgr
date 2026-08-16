"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string | null };
type PendingInvite = { id: string; token: string };

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  origin,
}: {
  householdId: string | null;
  members: Member[];
  pendingInvite: PendingInvite | null;
  currentUserId: string;
  origin: string;
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

  const inviteUrl = invite ? `${origin}/invite/${invite.token}` : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">It&apos;s just you so far.</p>
            </div>
          ) : (
            members.map((m) => {
              const isYou = m.id === currentUserId;
              const name = m.display_name || "Unnamed";
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <Avatar className="size-9">
                    <AvatarFallback
                      className={
                        isYou
                          ? "bg-primary text-xs font-semibold text-primary-foreground"
                          : "bg-muted text-xs font-semibold text-foreground"
                      }
                    >
                      {initialsOf(name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="flex-1 truncate text-sm font-medium">{name}</p>
                  {isYou && <Badge variant="secondary">You</Badge>}
                </div>
              );
            })
          )}
          {members.length > 1 && (
            <p className="pt-1 text-xs text-muted-foreground">
              Each person edits their own name under &quot;Your profile.&quot;
            </p>
          )}
          {householdId && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={leaveHousehold}
              className="mt-3 gap-2"
            >
              <LogOut className="size-4" />
              Leave household
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invite ? (
            <>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl ?? ""} className="font-mono text-xs" />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!inviteUrl}
                  onClick={() => inviteUrl && navigator.clipboard.writeText(inviteUrl)}
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
