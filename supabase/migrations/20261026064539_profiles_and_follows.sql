-- PROFILES
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null,
  bio text default '',
  avatar_url text,
  banner_url text,
  category text,
  links jsonb not null default '[]',
  role user_role not null default 'fan',
  is_suspended boolean not null default false,
  follower_count int not null default 0,
  following_count int not null default 0,
  created_at timestamptz not null default now()
);

create index profiles_search on profiles using gin (
  (username::text || ' ' || display_name) gin_trgm_ops
);

-- CREATOR SETTINGS
create table creator_settings (
  creator_id uuid primary key references profiles(id) on delete cascade,
  subscription_price_kobo int check (subscription_price_kobo >= 10000),
  tips_enabled boolean not null default true,
  min_tip_kobo int not null default 10000,
  bank_code text,
  account_last4 text,
  account_name text,
  paystack_subaccount_code text,
  paystack_plan_code text,
  payout_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

-- FOLLOWS
create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following on follows (following_id);

-- RLS
alter table profiles enable row level security;
alter table creator_settings enable row level security;
alter table follows enable row level security;

-- profiles: public read, owner update, insert only via trigger (W2-03)
create policy profiles_read on profiles
  for select using (true);

create policy profiles_update_own on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- creator_settings: owner only (contains payout info)
create policy settings_read_own on creator_settings
  for select using (creator_id = auth.uid());

create policy settings_insert_own on creator_settings
  for insert with check (creator_id = auth.uid());

create policy settings_update_own on creator_settings
  for update using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- follows: public read, users manage only their own follows
create policy follows_read on follows
  for select using (true);

create policy follows_insert_own on follows
  for insert with check (follower_id = auth.uid());

create policy follows_delete_own on follows
  for delete using (follower_id = auth.uid());

-- Block users from changing their own role or suspension (plan 7.3)
create or replace function prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and (
    new.role is distinct from old.role
    or new.is_suspended is distinct from old.is_suspended
  ) then
    raise exception 'role and suspension can only be changed by the service role';
  end if;
  return new;
end;
$$;

create trigger profiles_no_escalation
  before update on profiles
  for each row execute function prevent_role_escalation();

-- updated_at helper
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger creator_settings_updated_at
  before update on creator_settings
  for each row execute function set_updated_at();