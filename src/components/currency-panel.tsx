"use client";

import type { ReactNode } from "react";
import { useCurrency } from "@/components/currency-context";

// Shows only the block for the currently-selected currency (from
// CurrencyProvider) -- the switching UI itself lives in BalanceCard's
// clickable amount tiles; this just reacts to that selection. Every
// currency's data is already server-rendered into `children`, so
// switching which one shows is a pure client-side show/hide, no refetch
// and no skeleton.
export function CurrencyPanel({
  currencies,
  children,
}: {
  currencies: string[];
  children: ReactNode[];
}) {
  const currency = useCurrency();
  const selected =
    currency?.selected && currencies.includes(currency.selected) ? currency.selected : currencies[0];

  if (currencies.length <= 1) {
    return <>{children[0] ?? null}</>;
  }

  return (
    <>
      {currencies.map((c, i) => (
        <div key={c} className={c === selected ? "space-y-6" : "hidden"}>
          {children[i]}
        </div>
      ))}
    </>
  );
}
