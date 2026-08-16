import { cookies } from "next/headers";
import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const household = await getHousehold(user.id);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || user.email || "You";
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("sidebar-collapsed")?.value === "1";

  return (
    <AppShell
      householdName={household?.name ?? null}
      displayName={displayName}
      initialCollapsed={initialCollapsed}
    >
      {children}
    </AppShell>
  );
}
