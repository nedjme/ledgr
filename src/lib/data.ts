import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}

export async function getHousehold(userId: string) {
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
}
