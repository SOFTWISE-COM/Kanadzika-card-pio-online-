-- =====================================================================
-- FOTO DE PERFIL - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run
-- =====================================================================

-- Pasta (bucket) pública para as fotos, máximo 1 MB, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "avatars: todos veem"          on storage.objects;
drop policy if exists "avatars: cada um envia a sua"  on storage.objects;
drop policy if exists "avatars: cada um troca a sua"  on storage.objects;
drop policy if exists "avatars: cada um apaga a sua"  on storage.objects;

-- Qualquer pessoa pode VER as fotos (aparecem no app)
create policy "avatars: todos veem" on storage.objects
  for select using (bucket_id = 'avatars');

-- Cada utilizador só mexe na SUA pasta (avatars/<id-do-utilizador>/...)
create policy "avatars: cada um envia a sua" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: cada um troca a sua" on storage.objects
  for update to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: cada um apaga a sua" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
