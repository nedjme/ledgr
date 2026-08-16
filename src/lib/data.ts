import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Every page calls both of these, and its layout calls them again for the
// nav shell -- without caching that's 2x the auth round-trips and 2x the
// household lookups on every single navigation. React's cache() dedupes
// repeated calls (same args) within one request, so the layout and the
// page share a single network round-trip instead of doubling it.
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
});

export const getHousehold = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return null;

  const { data: household } = await supabase
    .from("households")
    .select("id, name")
    .eq("id", membership.household_id)
    .single();

  return household ?? null;
});
