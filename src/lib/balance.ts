// Balances themselves are computed in Postgres (see account_balances() in
// supabase/migrations/0016 and its callers) rather than fetched-and-summed
// here -- an account with enough transaction history can exceed what
// PostgREST returns from a plain unbounded select, so summing client-side
// silently undercounts once that happens. This just buckets already-computed
// per-account balances by currency for the combined "Current balance" tiles.
export function sumByCurrency(rows: { currency: string; balance: number }[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.balance);
  }
  return totals;
}
