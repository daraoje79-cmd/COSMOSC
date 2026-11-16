-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_name text;
  v_role user_role;
begin
  v_username := lower(trim(new.raw_user_meta_data->>'username'));
  v_name := trim(new.raw_user_meta_data->>'display_name');

  -- Only fan or creator can be chosen at signup. Never admin.
  v_role := case
    when new.raw_user_meta_data->>'role' = 'creator' then 'creator'::user_role
    else 'fan'::user_role
  end;

  insert into public.profiles (id, username, display_name, role)
  values (new.id, v_username, coalesce(nullif(v_name, ''), v_username), v_role);

  if v_role = 'creator' then
    insert into public.creator_settings (creator_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Public username availability check (returns true if free)
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from profiles where username = lower(trim(p_username))::citext
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;