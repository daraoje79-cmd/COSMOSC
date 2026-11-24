insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public', 'public', true, 8388608, array['image/jpeg','image/png','image/webp']),
  ('private', 'private', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

create policy "public_read" on storage.objects
  for select using (bucket_id = 'public');

create policy "public_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);