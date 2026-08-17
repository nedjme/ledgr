-- Household members can now see each other's budgets and goals -- same
-- "shared visibility, owner-only edits" model transactions already use
-- (see 0001 + 0006): a household_id column for scoping reads, while every
-- write (insert/update/delete) stays owner-only regardless of household_id.
alter table budgets add column household_id uuid references households(id) on delete set null;
alter table goals add column household_id uuid references households(id) on delete set null;

drop policy "budgets: owner all" on budgets;
create policy "budgets: owner select" on budgets
  for select using (user_id = auth.uid());
create policy "budgets: household select" on budgets
  for select using (
    household_id is not null
    and exists (
      select 1 from household_members hm
      where hm.household_id = budgets.household_id and hm.user_id = auth.uid()
    )
  );
create policy "budgets: owner insert" on budgets
  for insert with check (user_id = auth.uid());
create policy "budgets: owner update" on budgets
  for update using (user_id = auth.uid());
create policy "budgets: owner delete" on budgets
  for delete using (user_id = auth.uid());

drop policy "goals: owner all" on goals;
create policy "goals: owner select" on goals
  for select using (user_id = auth.uid());
create policy "goals: household select" on goals
  for select using (
    household_id is not null
    and exists (
      select 1 from household_members hm
      where hm.household_id = goals.household_id and hm.user_id = auth.uid()
    )
  );
create policy "goals: owner insert" on goals
  for insert with check (user_id = auth.uid());
create policy "goals: owner update" on goals
  for update using (user_id = auth.uid());
create policy "goals: owner delete" on goals
  for delete using (user_id = auth.uid());

-- A contribution's visibility follows its parent goal's sharing rather
-- than carrying its own household_id -- still owner-only to write, since
-- logging progress toward a goal is the owner's alone even once the goal
-- itself is visible to their household.
drop policy "goal_contributions: owner all" on goal_contributions;
create policy "goal_contributions: owner select" on goal_contributions
  for select using (user_id = auth.uid());
create policy "goal_contributions: household select" on goal_contributions
  for select using (
    exists (
      select 1 from goals g
      join household_members hm on hm.household_id = g.household_id
      where g.id = goal_contributions.goal_id and hm.user_id = auth.uid()
    )
  );
create policy "goal_contributions: owner insert" on goal_contributions
  for insert with check (user_id = auth.uid());
create policy "goal_contributions: owner update" on goal_contributions
  for update using (user_id = auth.uid());
create policy "goal_contributions: owner delete" on goal_contributions
  for delete using (user_id = auth.uid());
