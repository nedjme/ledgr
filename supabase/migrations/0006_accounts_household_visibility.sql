-- accounts was the one table still fully siloed to its owner -- every other
-- household-shared table (transactions, categories, households,
-- household_members) already has a member-read policy. That's fine for
-- editing (still owner-only, unaffected by this) but blocks a household
-- member from ever seeing their partner's starting_balance, which is needed
-- to compute a combined "current balance" across both people's accounts.
-- Read-only: this adds a SELECT policy only, so it doesn't touch who can
-- insert/update/delete (still just the owner, via "accounts: owner all").
create policy "accounts: household select" on accounts
  for select using (
    exists (
      select 1 from household_members owner_membership
      where owner_membership.user_id = accounts.user_id
        and public.is_household_member(owner_membership.household_id)
    )
  );
