import { headers } from "next/headers";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { HouseholdSettings } from "@/components/household-settings";
import { ProfileSettings } from "@/components/profile-settings";
import { CategoryManager } from "@/components/category-manager";

export default async function HouseholdSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Read the real request host instead of window.location.origin -- this is
  // known server-side (works on any deployment/preview URL with zero config)
  // and keeps the invite link identical between server and client render,
  // avoiding a hydration mismatch.
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol =
    headersList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "";

  const [household, { data: ownProfile }] = await Promise.all([
    getHousehold(user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);

  const [membershipsResult, inviteResult, { data: categories }] = await Promise.all([
    household
      ? supabase.from("household_members").select("user_id").eq("household_id", household.id)
      : Promise.resolve({ data: null as { user_id: string }[] | null }),
    household
      ? supabase
          .from("invites")
          .select("id, token")
          .eq("household_id", household.id)
          .eq("created_by", user.id)
          .is("accepted_by", null)
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; token: string } | null }),
    supabase
      .from("categories")
      .select("id, name, icon")
      .or(household ? `household_id.eq.${household.id}` : "household_id.is.null")
      .order("name"),
  ]);

  let members: { id: string; display_name: string | null }[] = [];
  if (household) {
    const memberIds = (membershipsResult.data ?? []).map((m) => m.user_id);
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      members = profiles ?? [];
    }
  }
  const pendingInvite = inviteResult.data ?? null;

  return (
    <div className="space-y-6">
      <ProfileSettings initialDisplayName={ownProfile?.display_name ?? null} />
      <HouseholdSettings
        householdId={household?.id ?? null}
        members={members}
        pendingInvite={pendingInvite}
        currentUserId={user.id}
        origin={origin}
      />
      <CategoryManager categories={categories ?? []} householdId={household?.id ?? null} />
    </div>
  );
}
