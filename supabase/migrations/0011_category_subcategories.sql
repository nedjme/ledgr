-- Supersedes the merge-and-delete flow from 0010: categories now nest one
-- level deep instead of being consolidated away. A subcategory's spend
-- rolls up into its parent's totals everywhere except when drilling into
-- that specific parent, where the breakdown is shown per-subcategory.
-- Nothing ever gets deleted or renamed by this, so the "when you see X,
-- use Y" alias mapping (built to survive a category's deletion) has no
-- role left to play.
drop function if exists public.merge_category(uuid, uuid);
drop table if exists category_aliases;

alter table categories add column parent_id uuid references categories(id) on delete set null;

create function public.check_category_nesting_depth()
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

  return new;
end;
$$;

create trigger category_nesting_depth
  before insert or update of parent_id on categories
  for each row execute procedure public.check_category_nesting_depth();
