-- Ejecutar en Supabase → SQL Editor para corregir el 400 de versat-sync-products.
-- Asegura que existan las columnas y que la primera fila de integraciones tenga la config VERSAT.

-- 1) Agregar columnas si no existen
alter table if exists public.integraciones
  add column if not exists versat_base_url text,
  add column if not exists versat_empresa_id integer,
  add column if not exists versat_user text,
  add column if not exists versat_password text;

-- 2) Actualizar TODAS las filas de integraciones con la config VERSAT
update public.integraciones
set
  versat_base_url = 'https://app.versat.ag',
  versat_empresa_id = 458,
  versat_user = 'kauang',
  versat_password = 'testeteste';

-- 3) Si no hay ninguna fila, insertar una
insert into public.integraciones (versat_base_url, versat_empresa_id, versat_user, versat_password)
select 'https://app.versat.ag', 458, 'kauang', 'testeteste'
where not exists (select 1 from public.integraciones limit 1);
