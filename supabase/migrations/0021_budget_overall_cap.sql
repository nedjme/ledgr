-- An Overall budget is a cap on total spend in a currency -- category
-- budgets underneath it shouldn't be able to collectively promise more
-- than that cap allows. The app already checks this client-side
-- (budgetExceedsOverallCap in src/lib/budgets.ts) before letting the
-- Add/Edit Budget forms submit, but that's only advisory against a
-- snapshot fetched at page-load time -- a second tab, or a direct API
-- call, can still race past it. This is the same defense-in-depth shape as
-- budgets_scope_idx (0012) and check_category_nesting_depth (0011):
-- enforce the invariant in the database too, not just in the form.
create function public.check_budget_overall_cap()
returns trigger
language plpgsql
as $$
declare
  v_overall_amount numeric;
  v_other_category_total numeric;
begin
  select coalesce(sum(amount), 0) into v_other_category_total
  from budgets
  where user_id = new.user_id
    and currency = new.currency
    and category_id is not null
    and id <> new.id;

  if new.category_id is null then
    if v_other_category_total > new.amount then
      raise exception
        'Category budgets in % already total %, more than this Overall amount',
        new.currency, v_other_category_total;
    end if;
  else
    select amount into v_overall_amount
    from budgets
    where user_id = new.user_id
      and currency = new.currency
      and category_id is null
    limit 1;

    if v_overall_amount is not null and v_other_category_total + new.amount > v_overall_amount then
      raise exception
        'Category budgets in % would total %, more than the Overall budget of %',
        new.currency, v_other_category_total + new.amount, v_overall_amount;
    end if;
  end if;

  return new;
end;
$$;

create trigger budget_overall_cap
  before insert or update of amount, category_id, currency on budgets
  for each row execute procedure public.check_budget_overall_cap();
