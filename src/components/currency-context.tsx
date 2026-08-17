"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type CurrencyContextValue = {
  selected: string;
  setSelected: (currency: string) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// Shared client-side selection so a click on one of BalanceCard's
// per-currency tiles can also decide which currency's Hero/stat/chart
// cards show further down the page -- they're sibling sections (not
// parent/child), so plain component state can't bridge them, but a
// provider wrapping both can. Not persisted to the URL: switching
// currency doesn't change what data is fetched (every currency is already
// loaded server-side), so there's nothing here worth a round-trip or a
// bookmarkable link -- see CurrencyPanel.
export function CurrencyProvider({
  defaultCurrency,
  children,
}: {
  defaultCurrency: string;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(defaultCurrency);
  return (
    <CurrencyContext.Provider value={{ selected, setSelected }}>{children}</CurrencyContext.Provider>
  );
}

// Returns null outside a provider (rather than throwing) so a component
// like BalanceCard can fall back to plain, non-interactive rendering
// wherever it's used without one, instead of forcing every caller to wrap
// it just in case.
export function useCurrency() {
  return useContext(CurrencyContext);
}
