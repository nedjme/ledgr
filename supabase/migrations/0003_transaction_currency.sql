-- Currency was never tracked per transaction, so every display defaulted to
-- MAD regardless of the account's actual currency -- a EUR account's
-- activity got silently summed into a MAD-labeled total instead of shown
-- as its own thing.
--
-- Denormalized onto transactions (rather than joined from accounts) for the
-- same reason user_id/household_id are: the joint dashboard reads a
-- partner's transactions via the household RLS policy, but accounts stays
-- owner-only, so there's no policy that would let a join to the partner's
-- accounts row resolve at all.
alter table transactions add column currency text not null default 'MAD';

update transactions t
set currency = a.currency
from accounts a
where a.id = t.account_id;
