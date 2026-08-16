import { requireUser, getHousehold } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TransactionsFilterBar } from "@/components/transactions-filter-bar";
import { TransactionList } from "@/components/transaction-list";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_SIZE = 30;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    q?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  const params = await searchParams;

  const scope = params.scope === "household" && household ? "household" : "personal";
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();

  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .or(household ? `household_id.eq.${household.id}` : "household_id.is.null")
      .order("name"),
    supabase.from("accounts").select("id, name, currency").eq("user_id", user.id),
  ]);
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  let query = supabase
    .from("transactions")
    .select(
      "id, account_id, occurred_at, description, amount, currency, category_id, user_id",
      { count: "exact" },
    );

  query =
    scope === "household"
      ? query.eq("household_id", household!.id)
      : query.eq("user_id", user.id);

  if (q) query = query.ilike("description", `%${q}%`);
  if (category === "uncategorized") query = query.is("category_id", null);
  else if (category) query = query.eq("category_id", category);

  const from = (page - 1) * PAGE_SIZE;
  const { data: transactions, count } = await query
    .order("occurred_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const rows = transactions ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  let nameById = new Map<string, string>();
  if (scope === "household") {
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", household!.id);
    const memberIds = (members ?? []).map((m) => m.user_id);
    if (memberIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "Partner"]));
    }
  }

  return (
    <div className="space-y-6">
      <TransactionsFilterBar
        categories={categories ?? []}
        showScope={!!household}
        scope={scope}
        q={q}
        category={category}
      />

      <Card>
        <CardContent>
          <TransactionList
            showOwner={scope === "household"}
            rows={rows.map((t) => ({
              id: t.id,
              account_id: t.account_id,
              category_id: t.category_id,
              user_id: t.user_id,
              occurred_at: t.occurred_at,
              description: t.description,
              amount: t.amount,
              currency: t.currency,
              category_name: t.category_id ? categoryById.get(t.category_id) ?? null : null,
              owner_name: scope === "household" ? nameById.get(t.user_id) ?? null : null,
            }))}
            editable={{ currentUserId: user.id, accounts: accounts ?? [], categories: categories ?? [] }}
          />
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/transactions"
        params={{ scope: scope === "household" ? "household" : undefined, q, category }}
      />
    </div>
  );
}
