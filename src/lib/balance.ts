export type AccountLike = {
  id: string;
  user_id: string;
  currency: string;
  starting_balance: number;
};

export type TransactionAmount = {
  account_id: string;
  amount: number;
};

// Current balance = the balance an account had before it was tracked here,
// plus every transaction logged against it since. Not period-scoped -- this
// is a snapshot as of now, independent of whatever week/month is selected.
export function accountBalances<T extends AccountLike>(
  accounts: T[],
  transactions: TransactionAmount[],
) {
  const deltaByAccount = new Map<string, number>();
  for (const t of transactions) {
    deltaByAccount.set(t.account_id, (deltaByAccount.get(t.account_id) ?? 0) + t.amount);
  }

  return accounts.map((account) => ({
    ...account,
    balance: account.starting_balance + (deltaByAccount.get(account.id) ?? 0),
  }));
}

export function sumByCurrency(rows: { currency: string; balance: number }[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.balance);
  }
  return totals;
}
