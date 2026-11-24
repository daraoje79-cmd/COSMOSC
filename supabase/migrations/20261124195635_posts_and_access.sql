-- POSTS
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  teaser text default '',
  visibility post_vis not null default 'public',
  price_kobo int check (price_kobo is null or price_kobo >= 10000),
  category text,
  status post_status not null default 'published',
  like_count int not null default 0,
  comment_count int not null default 0,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  check ((visibility = 'paid') = (price_kobo is not null))
);

create index posts_author_time on posts (author_id, created_at desc, id desc);
create index posts_time on posts (created_at desc, id desc) where status = 'published';

-- POST CONTENT (full body, separate so SELECT on posts cannot leak it)
create table post_content (
  post_id uuid primary key references posts(id) on delete cascade,
  body text not null default ''
);

-- POST MEDIA
create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  kind media_kind not null,
  bucket text not null check (bucket in ('public','private')),
  storage_key text not null,
  thumb_key text,
  width int,
  height int,
  duration_s int,
  size_bytes bigint,
  position smallint not null default 0
);

create index post_media_post on post_media (post_id, position);

-- SUBSCRIPTIONS and PURCHASES (needed by has_access; filled in Weeks 5-6)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id),
  creator_id uuid not null references profiles(id),
  status sub_status not null default 'pending',
  paystack_sub_code text unique,
  paystack_email_token text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  unique (subscriber_id, creator_id)
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id),
  post_id uuid not null references posts(id),
  transaction_id uuid not null,
  created_at timestamptz not null default now(),
  unique (buyer_id, post_id)
);

alter table subscriptions enable row level security;
alter table purchases enable row level security;

create policy subs_read on subscriptions
  for select using (subscriber_id = auth.uid() or creator_id = auth.uid());
create policy purchases_read on purchases
  for select using (buyer_id = auth.uid());
-- no insert/update policies: only the service role (server) writes these

-- ACCESS FUNCTION
create or replace function public.has_access(p_post uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_post
      and p.status = 'published'
      and (
        p.visibility = 'public'
        or p.author_id = auth.uid()
        or (p.visibility = 'subscribers' and exists (
              select 1 from subscriptions s
              where s.subscriber_id = auth.uid()
                and s.creator_id = p.author_id
                and s.status in ('active','non_renewing')
                and s.current_period_end > now()))
        or (p.visibility = 'paid' and exists (
              select 1 from purchases u
              where u.buyer_id = auth.uid() and u.post_id = p.id))
      )
  );
$$;

grant execute on function public.has_access(uuid) to anon, authenticated;

-- RLS: POSTS
alter table posts enable row level security;

create policy posts_read on posts
  for select using (status = 'published' or author_id = auth.uid());

create policy posts_insert on posts
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'creator')
  );

create policy posts_update on posts
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- RLS: POST CONTENT
alter table post_content enable row level security;

create policy content_read on post_content
  for select using (has_access(post_id));

create policy content_insert on post_content
  for insert with check (
    exists (select 1 from posts where id = post_id and author_id = auth.uid())
  );

create policy content_update on post_content
  for update using (
    exists (select 1 from posts where id = post_id and author_id = auth.uid())
  );

-- RLS: POST MEDIA
alter table post_media enable row level security;

create policy media_read on post_media
  for select using (has_access(post_id));

create policy media_insert on post_media
  for insert with check (
    exists (select 1 from posts where id = post_id and author_id = auth.uid())
  );

create policy media_delete on post_media
  for delete using (
    exists (select 1 from posts where id = post_id and author_id = auth.uid())
  );

-- Prevent authors from downgrading visibility after purchases (POST-4)
create or replace function public.guard_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility is distinct from old.visibility
     and old.visibility = 'paid'
     and exists (select 1 from purchases where post_id = old.id) then
    raise exception 'cannot change visibility of a post that has been purchased';
  end if;
  return new;
end;
$$;

create trigger posts_visibility_guard
  before update on posts
  for each row execute function public.guard_visibility_change();