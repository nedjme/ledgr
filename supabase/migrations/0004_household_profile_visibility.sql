-- profiles only had a "select your own row" policy. Every other
-- household-shared table (household_members, households, categories,
-- transactions) got a member-visibility policy, but profiles was missed --
-- so the household settings page could only ever resolve the *viewer's*
-- own name for the members list, silently dropping their partner's row.
-- (RLS policies for the same command are OR'd together, so this adds to
-- the existing "profiles: self select" policy rather than replacing it.)
create policy "profiles: household member select" on profiles
  for select using (
    exists (
      select 1
      from household_members mine
      join household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );
