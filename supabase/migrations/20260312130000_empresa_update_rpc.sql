-- Función que actualiza empresa con privilegios de dueño (evita bloqueos por RLS)
create or replace function public.update_empresa_datos(
  p_id uuid,
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
  update public.empresa
  set
    ruc = p_ruc,
    direccion = p_direccion,
    telefono = p_telefono,
    logo_url = p_logo_url,
    logo_informes_url = p_logo_informes_url,
    updated_at = now()
  where id = p_id
  returning *;
$$;

-- Solo usuarios autenticados pueden llamar la función
grant execute on function public.update_empresa_datos(uuid, text, text, text, text, text) to authenticated;

comment on function public.update_empresa_datos is 'Actualiza datos de empresa (logos, RUC, etc.). Usa SECURITY DEFINER para evitar bloqueos por RLS.';
