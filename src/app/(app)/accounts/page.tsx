import Link from "next/link";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AccountCard } from "@/components/account-card";

export default async function AccountsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency, starting_balance")
      .eq("user_id", user.id)
      .order("name"),
    supabase.from("transactions").select("account_id, amount").eq("user_id", user.id),
  ]);

  const balanceByAccount = new Map<string, number>();
  for (const t of transactions ?? []) {
    balanceByAccount.set(t.account_id, (balanceByAccount.get(t.account_id) ?? 0) + t.amount);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/accounts/import" />}
        >
          Import statement
        </Button>
        <AddAccountDialog />
      </div>

      {accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={account.starting_balance + (balanceByAccount.get(account.id) ?? 0)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No accounts yet. Add one to start logging transactions.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
