-- Garantir que usuarios autenticados puedan INSERT y UPDATE en empresa (logos y datos)
alter table if exists public.empresa enable row level security;

drop policy if exists "allow_authenticated_insert_empresa" on public.empresa;
create policy "allow_authenticated_insert_empresa" on public.empresa
  for insert to authenticated with check (true);

drop policy if exists "allow_authenticated_update_empresa" on public.empresa;
create policy "allow_authenticated_update_empresa" on public.empresa
  for update to authenticated using (true) with check (true);
