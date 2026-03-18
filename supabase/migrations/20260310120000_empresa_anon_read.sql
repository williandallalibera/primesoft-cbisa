-- Permitir lectura pública de empresa (logo_url) para la pantalla de login sin sesión
alter table if exists public.empresa enable row level security;

drop policy if exists "allow_anon_read_empresa" on public.empresa;
create policy "allow_anon_read_empresa" on public.empresa
  for select to anon using (true);

drop policy if exists "allow_authenticated_read_empresa" on public.empresa;
create policy "allow_authenticated_read_empresa" on public.empresa
  for select to authenticated using (true);

drop policy if exists "allow_authenticated_all_empresa" on public.empresa;
create policy "allow_authenticated_all_empresa" on public.empresa
  for all to authenticated using (true) with check (true);
