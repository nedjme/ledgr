-- Nesting a category that already has a budget scoped to it silently broke
-- that budget: budgetSpent() and the budgets UI both assumed a budget's
-- category_id was always top-level, so once it gained a parent, spend
-- computed as zero and the card mislabeled itself "Overall" (categoryById
-- there only searched top-level categories). Both are now fixed to handle
-- a subcategory-referencing budget gracefully, but the product's own stated
-- intent is still "a budget is scoped to a top-level category" (see
-- src/lib/budgets.ts) -- so block the nesting move at the source instead of
-- only patching around it, the same way check_category_nesting_depth()
-- already blocks the other invalid nesting shapes.
create or replace function public.check_category_nesting_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent';
  end if;

  if exists (select 1 from categories where id = new.parent_id and parent_id is not null) then
    raise exception 'Categories can only nest one level deep';
  end if;

  if exists (select 1 from categories where parent_id = new.id) then
    raise exception 'A category with subcategories of its own cannot become a subcategory';
  end if;

  if exists (select 1 from budgets where category_id = new.id) then
    raise exception 'A category with a budget cannot become a subcategory -- remove or reassign its budget first';
  end if;

  return new;
end;
$$;
