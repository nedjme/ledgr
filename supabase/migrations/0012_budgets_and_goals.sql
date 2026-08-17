-- Budgets: a spending limit per period (week or month), either overall
-- (category_id null) or scoped to one top-level category -- spend rolls up
-- from subcategories the same way every other category total already does
-- (see topCategoryId), so budgeting a subcategory specifically isn't
-- supported. Personal only, like accounts: a shared household category can
-- still get its own limit per member, matching how "Spent" on the
-- dashboard is already a per-person number, not a combined one. Periods
-- always reset (no rollover) and are computed live off transactions rather
-- than stored as rows, so there's nothing to regenerate on a schedule.
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  period text not null check (period in ('week', 'month')),
  amount numeric not null check (amount > 0),
  currency text not null default 'MAD',
  created_at timestamptz not null default now()
);

-- One budget per user per category per period -- "overall" is
-- category_id is null, coalesced to a fixed sentinel since null <> null
-- in a unique index and wouldn't otherwise dedupe.
create unique index budgets_scope_idx on budgets(
  user_id,
  coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  period,
  currency
);

alter table budgets enable row level security;

create policy "budgets: owner all" on budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Goals: a target amount to reach (saving toward something) or pay down
-- (a debt), tracked by manually logged contributions rather than derived
-- from any account or category balance -- works uniformly for both
-- directions and doesn't assume a goal maps to exactly one account.
-- Progress is the sum of its contributions, computed at read time (see
-- accounts.starting_balance + transactions for the same pattern already
-- used for account balances) rather than a denormalized running total.
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  target_date date,
  currency text not null default 'MAD',
  created_at timestamptz not null default now()
);

alter table goals enable row level security;

create policy "goals: owner all" on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Denormalizes the parent goal's currency onto every contribution (rather
-- than joining goals to read it) purely for query convenience -- same
-- shape as transactions.currency, just without that one's RLS motivation
-- since goal_contributions has no household-sharing story to begin with.
create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'MAD',
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index goal_contributions_goal_id_idx on goal_contributions(goal_id);

alter table goal_contributions enable row level security;

create policy "goal_contributions: owner all" on goal_contributions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
