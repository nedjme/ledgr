-- household_id on budgets/goals (added in 0014) is only ever set at
-- insert time -- a budget created before 0014 shipped, or before its
-- owner had joined a household yet, is stuck with household_id null
-- forever, since Edit never touches that column. accounts solved the
-- same visibility problem differently (see 0006): a live join through
-- household_members instead of a stored id, which can't go stale because
-- it's evaluated against *current* membership on every read. Switch
-- budgets/goals/goal_contributions to that same pattern and drop the
-- column -- one less thing that needs backfilling if it drifts again.
drop policy "budgets: household select" on budgets;
create policy "budgets: household select" on budgets
  for select using (
    exists (
      select 1 from household_members my_membership
      join household_members owner_membership
        on owner_membership.household_id = my_membership.household_id
      where my_membership.user_id = auth.uid()
        and owner_membership.user_id = budgets.user_id
    )
  );

drop policy "goals: household select" on goals;
create policy "goals: household select" on goals
  for select using (
    exists (
      select 1 from household_members my_membership
      join household_members owner_membership
        on owner_membership.household_id = my_membership.household_id
      where my_membership.user_id = auth.uid()
        and owner_membership.user_id = goals.user_id
    )
  );

drop policy "goal_contributions: household select" on goal_contributions;
create policy "goal_contributions: household select" on goal_contributions
  for select using (
    exists (
      select 1 from goals g
      join household_members my_membership on my_membership.user_id = auth.uid()
      join household_members owner_membership
        on owner_membership.household_id = my_membership.household_id
        and owner_membership.user_id = g.user_id
      where g.id = goal_contributions.goal_id
    )
  );

alter table budgets drop column household_id;
alter table goals drop column household_id;
