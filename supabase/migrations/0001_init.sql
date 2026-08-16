-- Ledgr schema + RLS
-- See build brief for the data model this implements.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  token text unique not null,
  created_by uuid not null references profiles(id),
  expires_at timestamptz,
  accepted_by uuid references profiles(id)
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  currency text not null default 'MAD'
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  icon text
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  household_id uuid references households(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  amount numeric not null,
  description text,
  occurred_at date not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index transactions_user_id_idx on transactions(user_id);
create index transactions_household_id_idx on transactions(household_id);
create index transactions_occurred_at_idx on transactions(occurred_at);
-- A profile belongs to at most one household (couples app, not groups).
create unique index household_members_user_id_idx on household_members(user_id);

-- Dedupe support for CSV import: same account + date + amount + description
-- should not be inserted twice.
create unique index transactions_dedupe_idx
  on transactions(account_id, occurred_at, amount, description);

alter table profiles enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table invites enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;

-- profiles: a user can read/update only their own profile.
create policy "profiles: self select" on profiles
  for select using (id = auth.uid());
create policy "profiles: self insert" on profiles
  for insert with check (id = auth.uid());
create policy "profiles: self update" on profiles
  for update using (id = auth.uid());

-- households: readable by members; no direct insert (created via RPC / invite flow).
create policy "households: member select" on households
  for select using (
    exists (
      select 1 from household_members hm
      where hm.household_id = households.id and hm.user_id = auth.uid()
    )
  );

-- household_members: members can see their household's roster; a user can
-- insert their own membership row (used by the invite-accept flow) and
-- remove themselves (leave household).
create policy "household_members: member select" on household_members
  for select using (
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
    )
  );
create policy "household_members: self insert" on household_members
  for insert with check (user_id = auth.uid());
create policy "household_members: self delete" on household_members
  for delete using (user_id = auth.uid());

-- invites: creator can manage; anyone authenticated can read a single invite
-- by token in order to accept it (token itself is the secret).
create policy "invites: creator select" on invites
  for select using (created_by = auth.uid());
create policy "invites: token select" on invites
  for select using (auth.role() = 'authenticated');
create policy "invites: creator insert" on invites
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from household_members hm
      where hm.household_id = invites.household_id and hm.user_id = auth.uid()
    )
  );
create policy "invites: accept update" on invites
  for update using (accepted_by is null)
  with check (accepted_by = auth.uid());

-- accounts: owner-only.
create policy "accounts: owner all" on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: readable/writable by household members; personal (no
-- household yet) categories are owned by nobody else, so restrict by
-- household membership only once a household_id is set.
create policy "categories: household select" on categories
  for select using (
    household_id is null
    or exists (
      select 1 from household_members hm
      where hm.household_id = categories.household_id and hm.user_id = auth.uid()
    )
  );
create policy "categories: household insert" on categories
  for insert with check (
    household_id is null
    or exists (
      select 1 from household_members hm
      where hm.household_id = categories.household_id and hm.user_id = auth.uid()
    )
  );
create policy "categories: household update" on categories
  for update using (
    exists (
      select 1 from household_members hm
      where hm.household_id = categories.household_id and hm.user_id = auth.uid()
    )
  );
create policy "categories: household delete" on categories
  for delete using (
    exists (
      select 1 from household_members hm
      where hm.household_id = categories.household_id and hm.user_id = auth.uid()
    )
  );

-- transactions: full CRUD on your own rows; read-only on your household's
-- combined rows (this is what powers the joint dashboard).
create policy "transactions: owner select" on transactions
  for select using (user_id = auth.uid());
create policy "transactions: household select" on transactions
  for select using (
    household_id is not null
    and exists (
      select 1 from household_members hm
      where hm.household_id = transactions.household_id and hm.user_id = auth.uid()
    )
  );
create policy "transactions: owner insert" on transactions
  for insert with check (user_id = auth.uid());
create policy "transactions: owner update" on transactions
  for update using (user_id = auth.uid());
create policy "transactions: owner delete" on transactions
  for delete using (user_id = auth.uid());

-- New auth user -> profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Households have no direct insert policy (see RLS above) -- creation only
-- happens through this RPC, which atomically creates the household and adds
-- the caller as its first member. Used by the "invite partner" flow.
create function public.create_household(household_name text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into households (name) values (household_name)
  returning id into new_household_id;

  insert into household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  return new_household_id;
end;
$$;

-- Accepting an invite: adds the caller to the household and marks the
-- invite used. Wrapped in an RPC so both writes commit together.
create function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_household_id uuid;
begin
  select household_id into target_household_id
  from invites
  where token = invite_token
    and accepted_by is null
    and (expires_at is null or expires_at > now());

  if target_household_id is null then
    raise exception 'Invite is invalid or has expired';
  end if;

  insert into household_members (household_id, user_id)
  values (target_household_id, auth.uid())
  on conflict do nothing;

  update invites set accepted_by = auth.uid() where token = invite_token;

  return target_household_id;
end;
$$;
