import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/category-manager";

export default async function CategoriesSettingsPage() {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon")
    .or(household ? `household_id.eq.${household.id}` : "household_id.is.null")
    .order("name");

  return (
    <div className="space-y-6">
      <CategoryManager
        categories={categories ?? []}
        householdId={household?.id ?? null}
      />
    </div>
  );
}
