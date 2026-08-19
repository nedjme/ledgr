import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ImportFlow } from "@/components/import-flow";

export default async function ImportPage() {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const supabase = await createClient();

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id, name").eq("user_id", user.id),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Paste text copied from your bank&apos;s statement, or paste a CSV
        export. Duplicate rows (same date, amount and description) are
        skipped automatically, and categories found in the file that don&apos;t
        exist yet are created for you.
      </p>
      <ImportFlow
        accounts={accounts ?? []}
        categories={categories ?? []}
        householdId={household?.id ?? null}
      />
    </div>
  );
}
