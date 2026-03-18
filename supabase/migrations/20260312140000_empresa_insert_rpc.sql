-- Función que inserta la primera fila en empresa con privilegios de dueño (evita bloqueos por RLS)
create or replace function public.insert_empresa_datos(
  p_ruc text default null,
  p_direccion text default null,
  p_telefono text default null,
  p_logo_url text default null,
  p_logo_informes_url text default null
)
returns setof public.empresa
language sql
security definer
set search_path = public
as $$
  insert into public.empresa (ruc, direccion, telefono, logo_url, logo_informes_url)
  values (p_ruc, p_direccion, p_telefono, p_logo_url, p_logo_informes_url)
  returning *;
$$;

grant execute on function public.insert_empresa_datos(text, text, text, text, text) to authenticated;

comment on function public.insert_empresa_datos is 'Inserta la primera fila en empresa. Usa SECURITY DEFINER para evitar bloqueos por RLS.';
