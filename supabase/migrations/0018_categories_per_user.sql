-- Categories become fully personal (owned by one profile) instead of
-- shared across a household -- each household member should be able to
-- rename, recolor, delete, and restructure their own categories without
-- touching their partner's. This mirrors the accounts/budgets/goals shape
-- (owner-only writes) rather than the old household-wide table.
--
-- Backfill: category ownership was never tracked (no created_by column),
-- so an existing household-shared category can't simply be handed to
-- "whoever created it". Per product decision, every member who currently
-- has access to a category keeps a working copy of it -- the first member
-- (by user id, for determinism) reuses the existing row and id, everyone
-- else gets a duplicate, with any of their own transactions/budgets that
-- pointed at the shared row repointed onto their own copy. A subcategory's
-- parent_id is remapped to the same target user's copy of its parent
-- (categories are processed parents-first via categories_snapshot's order).
--
-- A category with a null household_id predates any household (see 0001's
-- note that such rows were reachable by any authenticated user under the
-- old permissive RLS) -- those are duplicated across every profile that
-- currently has no household, on the same "everyone who could see it keeps
-- a copy" logic. Either way, the target-user list also always includes
-- anyone with a transaction or budget actually pointing at the category,
-- so no historical reference is ever left dangling regardless of the
-- household/solo heuristic above.
--
-- Visibility stays shared read-only, like accounts (0006) and budgets/goals
-- (0017): a household member's own categories are read-only visible to
-- their partner via a live household_members join, so a partner's
-- transaction still shows a real category name/color on the joint
-- dashboard even though only its owner can edit or delete it.

alter table categories add column user_id uuid references profiles(id) on delete cascade;

create temporary table category_migration_map (
  old_id uuid not null,
  target_user uuid not null,
  new_id uuid not null,
  primary key (old_id, target_user)
);

create temporary table categories_snapshot as
  select * from categories order by (parent_id is not null), id;

do $$
declare
  cat record;
  v_target_user uuid;
  first_user uuid;
  new_cat_id uuid;
begin
  for cat in select * from categories_snapshot loop
    first_user := null;

    for v_target_user in
      select u.user_id from (
        select hm.user_id from household_members hm
          where cat.household_id is not null and hm.household_id = cat.household_id
        union
        select p.id as user_id from profiles p
          where cat.household_id is null
            and not exists (select 1 from household_members hm2 where hm2.user_id = p.id)
        union
        select t.user_id from transactions t where t.category_id = cat.id
        union
        select b.user_id from budgets b where b.category_id = cat.id
      ) u
      order by u.user_id
    loop
      if first_user is null then
        -- First target user reuses the original row/id -- their existing
        -- transactions/budgets already point at it, nothing to repoint.
        update categories
          set user_id = v_target_user,
              parent_id = case when cat.parent_id is not null then (
                select m.new_id from category_migration_map m
                where m.old_id = cat.parent_id and m.target_user = v_target_user
              ) else null end
          where id = cat.id;
        new_cat_id := cat.id;
        first_user := v_target_user;
      else
        insert into categories (name, icon, color, parent_id, user_id, household_id)
        values (
          cat.name, cat.icon, cat.color,
          case when cat.parent_id is not null then (
            select m.new_id from category_migration_map m
            where m.old_id = cat.parent_id and m.target_user = v_target_user
          ) else null end,
          v_target_user, cat.household_id
        )
        returning id into new_cat_id;

        update transactions set category_id = new_cat_id
          where category_id = cat.id and user_id = v_target_user;
        update budgets set category_id = new_cat_id
          where category_id = cat.id and user_id = v_target_user;
      end if;

      insert into category_migration_map (old_id, target_user, new_id)
        values (cat.id, v_target_user, new_cat_id);
    end loop;

    if first_user is null then
      raise notice 'category % (household_id=%, name=%) has no determinable owner -- will be dropped',
        cat.id, cat.household_id, cat.name;
    end if;
  end loop;
end $$;

-- Safety net: the target-user derivation above always includes anyone with
-- a transaction or budget pointing at a category, so nothing left unowned
-- should still be referenced. Abort rather than silently cascade-deleting
-- real budget data (categories -> budgets is ON DELETE CASCADE) if that
-- invariant somehow doesn't hold.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from categories c
  where c.user_id is null
    and (
      exists (select 1 from transactions t where t.category_id = c.id)
      or exists (select 1 from budgets b where b.category_id = c.id)
    );
  if bad_count > 0 then
    raise exception
      'categories_per_user backfill: % unowned categories are still referenced by transactions/budgets -- aborting',
      bad_count;
  end if;
end $$;

delete from categories where user_id is null;

alter table categories alter column user_id set not null;

drop policy "categories: household select" on categories;
drop policy "categories: household insert" on categories;
drop policy "categories: household update" on categories;
drop policy "categories: household delete" on categories;

alter table categories drop column household_id;

create policy "categories: owner all" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories: household select" on categories
  for select using (
    exists (
      select 1 from household_members owner_membership
      where owner_membership.user_id = categories.user_id
        and public.is_household_member(owner_membership.household_id)
    )
  );
