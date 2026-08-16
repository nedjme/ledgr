import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { HouseholdSettings } from "@/components/household-settings";
import { ProfileSettings } from "@/components/profile-settings";

export default async function HouseholdSettingsPage() {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const supabase = await createClient();

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  let members: { id: string; display_name: string | null }[] = [];
  let pendingInvite: { id: string; token: string } | null = null;

  if (household) {
    const { data: memberships } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", household.id);

    const memberIds = (memberships ?? []).map((m) => m.user_id);
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      members = profiles ?? [];
    }

    const { data: invite } = await supabase
      .from("invites")
      .select("id, token")
      .eq("household_id", household.id)
      .eq("created_by", user.id)
      .is("accepted_by", null)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    pendingInvite = invite;
  }

  return (
    <div className="space-y-6">
      <ProfileSettings initialDisplayName={ownProfile?.display_name ?? null} />
      <HouseholdSettings
        householdId={household?.id ?? null}
        members={members}
        pendingInvite={pendingInvite}
        currentUserId={user.id}
      />
    </div>
  );
}
