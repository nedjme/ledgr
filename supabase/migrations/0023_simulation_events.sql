-- A one-time future income (a bonus) or expense (a big trip) that isn't
-- part of the regular monthly pattern averageMonthlySavings already
-- captures, but should still bend a goal's projected completion date
-- around it. Scoped by (user, currency), not by a specific goal --
-- progress already draws from every account in that currency as one
-- shared pool, so a bonus or a big purchase affects every goal sharing
-- that currency identically, not just whichever one it was entered from.
-- Same visibility shape as goals/categories: owner writes, household reads
-- (live join, matching 0017/0006 rather than a stored column that can go
-- stale).
create table simulation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  currency text not null,
  label text not null,
  amount numeric not null,
  occurs_on date not null,
  created_at timestamptz not null default now()
);

create index simulation_events_user_currency_idx on simulation_events(user_id, currency);

alter table simulation_events enable row level security;

create policy "simulation_events: owner all" on simulation_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "simulation_events: household select" on simulation_events
  for select using (
    exists (
      select 1 from household_members owner_membership
      where owner_membership.user_id = simulation_events.user_id
        and public.is_household_member(owner_membership.household_id)
    )
  );
