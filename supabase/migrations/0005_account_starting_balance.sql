-- Lets an account carry a balance from before it was tracked in Ledgr, so
-- "current balance" can be shown as starting_balance + sum(transactions)
-- instead of assuming everything starts at zero.
alter table accounts add column starting_balance numeric not null default 0;
