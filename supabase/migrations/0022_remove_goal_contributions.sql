-- Manually typing "I saved X today" turned out to be busywork nobody used
-- (zero rows in this table in production) and disconnected from the real
-- income/spend data the app already has. Goals now derive progress from
-- the goal owner's actual account balances in the goal's currency, and
-- pace from their real average monthly net savings (src/lib/goals.ts) --
-- a simulation grounded in real transactions instead of a hand-kept
-- ledger. Safe to drop outright rather than deprecate: nothing references
-- it once the app stops writing to it.
drop table goal_contributions;
