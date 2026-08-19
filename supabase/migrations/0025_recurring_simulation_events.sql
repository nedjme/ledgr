-- Simulation events gain a category and a recurrence -- a monthly rent
-- payment or subscription is a standing commitment, not a one-off bonus or
-- trip, and it belongs to a category the same way a budget does. Because a
-- recurring event represents an ongoing commitment, it shouldn't be able
-- to simulate more spending than what's actually budgeted for that
-- category (a one-time event has no such cap -- a single big trip isn't a
-- standing commitment the way a recurring line is).
alter table simulation_events add column category_id uuid references categories(id) on delete set null;
alter table simulation_events add column recurrence text not null default 'once'
  check (recurrence in ('once', 'weekly', 'monthly', 'yearly'));
alter table simulation_events add column recurrence_end date;

-- Mirrors check_budget_overall_cap (0021): a client-side check backs this
-- up too, but the constraint is enforced here so a second tab or a direct
-- API call can't bypass it. category_id is matched with `is not distinct
-- from` rather than `=` so an Overall (null category_id) event correctly
-- matches an Overall budget instead of never matching a null. Only applies
-- to recurring *expenses* (amount < 0, compared via abs()) -- a budget
-- caps spending, not income, and expense amounts are stored negative here
-- same as transactions, so an unsigned `amount > budget` comparison would
-- both wrongly flag recurring income and never actually catch an
-- over-budget expense.
create function public.check_recurring_event_budget_cap()
returns trigger
language plpgsql
as $$
declare
  v_budget_amount numeric;
begin
  if new.recurrence = 'once' or new.amount >= 0 then
    return new;
  end if;

  select amount into v_budget_amount
  from budgets
  where user_id = new.user_id
    and currency = new.currency
    and category_id is not distinct from new.category_id
  limit 1;

  if v_budget_amount is not null and abs(new.amount) > v_budget_amount then
    raise exception
      'A recurring expense can''t exceed its category''s budget of %', v_budget_amount;
  end if;

  return new;
end;
$$;

create trigger recurring_event_budget_cap
  before insert or update of amount, category_id, currency, recurrence on simulation_events
  for each row execute procedure public.check_recurring_event_budget_cap();
