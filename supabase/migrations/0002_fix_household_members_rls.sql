-- The "household_members: member select" policy queried household_members
-- from inside its own USING clause, so every row check re-triggered the
-- same policy -> infinite recursion. Fix: check membership through a
-- SECURITY DEFINER function, which runs as the function owner and bypasses
-- RLS on its internal query, so it can't recurse into itself.
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "household_members: member select" on household_members;
create policy "household_members: member select" on household_members
  for select using (public.is_household_member(household_id));

drop policy if exists "households: member select" on households;
create policy "households: member select" on households
  for select using (public.is_household_member(id));

drop policy if exists "invites: creator insert" on invites;
create policy "invites: creator insert" on invites
  for insert with check (
    created_by = auth.uid()
    and public.is_household_member(household_id)
  );

drop policy if exists "categories: household select" on categories;
create policy "categories: household select" on categories
  for select using (
    household_id is null or public.is_household_member(household_id)
  );

drop policy if exists "categories: household insert" on categories;
create policy "categories: household insert" on categories
  for insert with check (
    household_id is null or public.is_household_member(household_id)
  );

drop policy if exists "categories: household update" on categories;
create policy "categories: household update" on categories
  for update using (public.is_household_member(household_id));

drop policy if exists "categories: household delete" on categories;
create policy "categories: household delete" on categories
  for delete using (public.is_household_member(household_id));

drop policy if exists "transactions: household select" on transactions;
create policy "transactions: household select" on transactions
  for select using (
    household_id is not null and public.is_household_member(household_id)
  );
