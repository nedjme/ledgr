-- Remembers "when a statement labels a transaction X, use category Y"
-- mappings, captured automatically whenever a category is merged into
-- another (see merge_category below) so a repeat import of the same
-- statement doesn't recreate the duplicate category it was merged away.
create table category_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  alias_name text not null,
  category_id uuid not null references categories(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index category_aliases_category_id_idx on category_aliases(category_id);

alter table category_aliases enable row level security;

-- Same household-scoping shape as categories: personal (no household yet)
-- rows are visible to any authenticated user but only updatable/deletable
-- once a household membership exists to check against.
create policy "category_aliases: household select" on category_aliases
  for select using (
    household_id is null
    or exists (
      select 1 from household_members hm
      where hm.household_id = category_aliases.household_id and hm.user_id = auth.uid()
    )
  );
create policy "category_aliases: household insert" on category_aliases
  for insert with check (
    household_id is null
    or exists (
      select 1 from household_members hm
      where hm.household_id = category_aliases.household_id and hm.user_id = auth.uid()
    )
  );
create policy "category_aliases: household update" on category_aliases
  for update using (
    exists (
      select 1 from household_members hm
      where hm.household_id = category_aliases.household_id and hm.user_id = auth.uid()
    )
  );
create policy "category_aliases: household delete" on category_aliases
  for delete using (
    exists (
      select 1 from household_members hm
      where hm.household_id = category_aliases.household_id and hm.user_id = auth.uid()
    )
  );

-- Merging category A into B: reassigns the caller's own transactions (RLS
-- still restricts each statement to rows the caller owns/can reach, same
-- as every other write in this app -- a household member's own
-- transactions move; a partner's shared transactions move only once they
-- merge too, or fall back to uncategorized like any other category
-- deletion), re-points any alias that used to resolve to A, remembers A's
-- name as a new alias for B, then removes A. security invoker (the
-- default) so none of that bypasses RLS.
create function public.merge_category(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql
security invoker set search_path = public
as $$
declare
  v_household_id uuid;
  v_name text;
begin
  if p_source_id = p_target_id then
    raise exception 'Cannot merge a category into itself';
  end if;

  select household_id, name into v_household_id, v_name
  from categories
  where id = p_source_id;

  if v_name is null then
    raise exception 'Source category not found';
  end if;

  update transactions set category_id = p_target_id where category_id = p_source_id;
  update category_aliases set category_id = p_target_id where category_id = p_source_id;

  delete from category_aliases
  where category_id = p_target_id
    and lower(alias_name) = lower(v_name)
    and household_id is not distinct from v_household_id;

  insert into category_aliases (household_id, alias_name, category_id)
  values (v_household_id, v_name, p_target_id);

  delete from categories where id = p_source_id;
end;
$$;
