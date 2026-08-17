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

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, currency, starting_balance")
    .eq("user_id", user.id)
    .order("name");

  // Computed in Postgres, not fetched-and-summed client-side -- an account
  // with enough transaction history can exceed what PostgREST returns from
  // a plain unbounded select. See account_balances() in
  // supabase/migrations/0016.
  const accountIds = (accounts ?? []).map((a) => a.id);
  const { data: balanceRows } =
    accountIds.length > 0
      ? await supabase.rpc("account_balances", { target_account_ids: accountIds })
      : { data: [] as { account_id: string; balance: number }[] };
  const balanceByAccount = new Map((balanceRows ?? []).map((b) => [b.account_id, Number(b.balance)]));

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
              balance={balanceByAccount.get(account.id) ?? account.starting_balance}
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
