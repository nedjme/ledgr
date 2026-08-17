-- Budgets are always monthly now -- a weekly budget vs. a monthly one
-- broken down by week (see the new weekly repartition on the budgets
-- page) covered the same ground, so the period picker was a false choice.
-- Dropping the column outright rather than just defaulting it, since a
-- "period" that only ever holds one value isn't a real dimension anymore.
drop index budgets_scope_idx;

-- A week and a month budget on the same category/currency were distinct
-- rows under the old uniqueness (which included period) but collide once
-- period is gone. Keep only the most recently created one per
-- (user_id, category, currency) -- its amount becomes the monthly amount
-- going forward.
delete from budgets where id in (
  select id from (
    select id, row_number() over (
      partition by user_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), currency
      order by created_at desc
    ) as rn
    from budgets
  ) ranked
  where rn > 1
);

alter table budgets drop column period;

create unique index budgets_scope_idx on budgets(
  user_id,
  coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  currency
);
