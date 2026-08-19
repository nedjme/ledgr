-- The recurring half of the simulation (as opposed to simulation_events,
-- the one-time half) becomes an explicit, saved assumption instead of a
-- silent 3-month-average default -- "expected monthly income/spend" that
-- you set yourself and that sticks until you change it. The trailing
-- historical average stays available, but purely as read-only reference
-- information (computed client-side per selected window from already-
-- fetched transactions, see averageMonthlySavingsByWindow), not something
-- silently baked into what the simulation actually uses.
--
-- Same scoping and visibility shape as simulation_events: one row per
-- (user, currency), not per goal -- an income/spend assumption isn't
-- goal-specific, it applies to every goal sharing that currency. Owner
-- writes, household reads (live join, matching every other table this
-- session).
create table savings_expectations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  currency text not null,
  expected_income numeric not null,
  expected_spend numeric not null,
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);

alter table savings_expectations enable row level security;

create policy "savings_expectations: owner all" on savings_expectations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "savings_expectations: household select" on savings_expectations
  for select using (
    exists (
      select 1 from household_members owner_membership
      where owner_membership.user_id = savings_expectations.user_id
        and public.is_household_member(owner_membership.household_id)
    )
  );
