-- accountBalances() (src/lib/balance.ts) summed *all* of a user's
-- transactions client-side by fetching every row and adding them up in
-- JS. Once an account passes ~1000 transactions, PostgREST's default row
-- cap silently truncates that fetch to an arbitrary subset -- no
-- ORDER BY was specified, so *which* rows come back isn't even stable
-- across requests -- producing a balance that's wildly wrong and jumps
-- unpredictably as data changes. Computing the sum in Postgres instead
-- sidesteps the row-transfer limit entirely: one row back per account,
-- correct by construction regardless of transaction count.
--
-- Runs as the calling user (no SECURITY DEFINER), so RLS still governs
-- exactly which transactions get summed -- for the household dashboard
-- this also retires the manual "my own transactions (all of them) +
-- partner's shared transactions (household-tagged only)" split that used
-- to live in application code: the transactions table's own RLS policies
-- already encode that split, so a plain join here inherits it for free.
create function public.account_balances(target_account_ids uuid[])
returns table(account_id uuid, user_id uuid, currency text, balance numeric)
language sql
stable
as $$
  select a.id, a.user_id, a.currency, a.starting_balance + coalesce(sum(t.amount), 0)
  from accounts a
  left join transactions t on t.account_id = a.id
  where a.id = any(target_account_ids)
  group by a.id, a.user_id, a.currency, a.starting_balance;
$$;
