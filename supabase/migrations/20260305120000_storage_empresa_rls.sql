-- Bucket empresa: crear si no existe y políticas RLS para que usuarios autenticados puedan subir logos
insert into storage.buckets (id, name, public, file_size_limit)
values ('empresa', 'empresa', true, 52428800)
on conflict (id) do update set file_size_limit = 52428800;

-- Políticas: autenticados pueden insertar, actualizar (upsert) y leer en bucket empresa
drop policy if exists "allow_authenticated_upload_empresa" on storage.objects;
create policy "allow_authenticated_upload_empresa" on storage.objects
  for insert to authenticated with check (bucket_id = 'empresa');

drop policy if exists "allow_authenticated_update_empresa" on storage.objects;
create policy "allow_authenticated_update_empresa" on storage.objects
  for update to authenticated using (bucket_id = 'empresa') with check (bucket_id = 'empresa');

drop policy if exists "allow_authenticated_read_empresa" on storage.objects;
create policy "allow_authenticated_read_empresa" on storage.objects
  for select to authenticated using (bucket_id = 'empresa');

drop policy if exists "allow_public_read_empresa" on storage.objects;
create policy "allow_public_read_empresa" on storage.objects
  for select to public using (bucket_id = 'empresa');

-- Anon puede leer para que las imágenes se vean en <img> y en PDFs
drop policy if exists "allow_anon_read_empresa" on storage.objects;
create policy "allow_anon_read_empresa" on storage.objects
  for select to anon using (bucket_id = 'empresa');

-- Algunos clientes envían upload como anon; permitir insert/update en bucket empresa
drop policy if exists "allow_anon_upload_empresa" on storage.objects;
create policy "allow_anon_upload_empresa" on storage.objects
  for insert to anon with check (bucket_id = 'empresa');
drop policy if exists "allow_anon_update_empresa" on storage.objects;
create policy "allow_anon_update_empresa" on storage.objects
  for update to anon using (bucket_id = 'empresa') with check (bucket_id = 'empresa');
