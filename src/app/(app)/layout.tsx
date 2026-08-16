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
  const supabase = await createClient();

  const [household, { data: profile }, cookieStore] = await Promise.all([
    getHousehold(user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    cookies(),
  ]);

  const displayName = profile?.display_name || user.email || "You";
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
