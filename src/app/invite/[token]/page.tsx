import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInvite } from "@/components/accept-invite";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invite } = await supabase
    .from("invites")
    .select("household_id, expires_at, accepted_by")
    .eq("token", token)
    .maybeSingle();

  const expired = invite?.expires_at ? new Date(invite.expires_at) < new Date() : false;
  const invalid = !invite || invite.accepted_by || expired;

  let householdName: string | null = null;
  if (invite && !invalid) {
    const { data: household } = await supabase
      .from("households")
      .select("name")
      .eq("id", invite.household_id)
      .single();
    householdName = household?.name ?? null;
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join {householdName || "the household"}</CardTitle>
          {!invalid && (
            <CardDescription>
              You&apos;ll see a combined dashboard. Nothing else changes — this
              is a tracker, not a splitter.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {invalid ? (
            <p className="text-sm text-muted-foreground">
              This invite link is invalid, expired, or already used.
            </p>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to accept this invite.
              </p>
              <Button
                className="w-full"
                nativeButton={false}
                render={<Link href={`/login?next=/invite/${token}`} />}
              >
                Sign in
              </Button>
            </div>
          ) : (
            <AcceptInvite token={token} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
