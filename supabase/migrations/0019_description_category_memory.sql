-- Categorization memory: correcting one transaction's category can now
-- also (a) apply that category to every other transaction with the same
-- underlying description, and (b) remember the correction so future CSV
-- imports categorize that merchant correctly without help. This is the
-- `description_category_rules` table categorize.ts already anticipated
-- ("Per-description corrections should be remembered going forward").
--
-- "Same underlying description" needs normalization -- real bank
-- descriptions repeat a merchant with a different trailing reference
-- number/date each time ("NETFLIX.COM RETRAIT CARTE 4821" one month,
-- "...CARTE 5190" the next). normalize_description() strips everything but
-- letters, collapsing digits/punctuation/whitespace away, so those collapse
-- to the same key. It's SQL (not application code) specifically so it can
-- back an indexed generated column on transactions and be the one source
-- of truth both the app and the parse-statement edge function match
-- against -- each still needs its own copy of the same algorithm (edge
-- functions can't import from src/lib), same tradeoff already accepted for
-- the keyword rules in categorize.ts.

create function public.normalize_description(description text)
returns text
language sql
immutable
as $$
  select nullif(trim(regexp_replace(lower(coalesce(description, '')), '[^a-z]+', ' ', 'g')), '')
$$;

alter table transactions
  add column description_key text generated always as (public.normalize_description(description)) stored;

create index transactions_description_key_idx
  on transactions(user_id, description_key)
  where description_key is not null;

create table description_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  pattern text not null,
  category_id uuid not null references categories(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (user_id, pattern)
);

alter table description_category_rules enable row level security;

-- Personal correction memory, not shared -- mirrors categories (owner-only,
-- no household-read policy): a rule learned from *your* corrections
-- shouldn't silently recategorize your partner's future imports.
create policy "description_category_rules: owner all" on description_category_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bulk-apply + remember as one atomic call instead of three client
-- round-trips. security invoker (the default) -- the update below is
-- still scoped to auth.uid() explicitly and still has to satisfy
-- "transactions: owner update", so this grants no more than the caller
-- could already do one row at a time.
create function public.apply_category_to_similar(
  p_transaction_id uuid,
  p_category_id uuid,
  p_remember boolean
)
returns integer
language plpgsql
security invoker set search_path = public
as $$
declare
  v_key text;
  v_updated integer;
begin
  select description_key into v_key
  from transactions
  where id = p_transaction_id and user_id = auth.uid();

  if v_key is null then
    return 0;
  end if;

  update transactions
    set category_id = p_category_id
    where user_id = auth.uid() and description_key = v_key;
  get diagnostics v_updated = row_count;

  if p_remember then
    insert into description_category_rules (user_id, pattern, category_id)
    values (auth.uid(), v_key, p_category_id)
    on conflict (user_id, pattern) do update
      set category_id = excluded.category_id, updated_at = now();
  end if;

  return v_updated;
end;
$$;
