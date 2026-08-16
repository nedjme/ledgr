"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EditAccountDialog } from "@/components/edit-account-dialog";
import { formatCurrency } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  currency: string;
  starting_balance: number;
};

export function AccountCard({ account, balance }: { account: Account; balance: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="cursor-pointer transition-colors hover:bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <CardContent className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{account.name}</p>
            <p className="text-sm text-muted-foreground">{account.currency}</p>
          </div>
          <p className="shrink-0 text-right font-semibold tabular-nums">
            {formatCurrency(balance, account.currency)}
          </p>
        </CardContent>
      </Card>

      <EditAccountDialog account={account} open={open} onOpenChange={setOpen} />
    </>
  );
}
