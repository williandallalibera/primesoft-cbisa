-- VERSAT: productos.id_versat + integraciones config para sync BP51/BP71

-- 1. productos: id_versat para upsert por producto VERSAT
alter table if exists productos
  add column if not exists id_versat bigint;

create unique index if not exists idx_productos_id_versat
  on productos (id_versat) where id_versat is not null;

comment on column productos.id_versat is 'ID del producto en VERSAT (BP51.id). Null = producto manual.';

-- 2. integraciones: config API VERSAT (URL, empresa_id, user, password)
alter table if exists integraciones
  add column if not exists versat_base_url text,
  add column if not exists versat_empresa_id integer,
  add column if not exists versat_user text,
  add column if not exists versat_password text;

comment on column integraciones.versat_base_url is 'Base URL API VERSAT, ej. https://app.versat.ag';
comment on column integraciones.versat_empresa_id is 'empresa_id para Polling/Data';
comment on column integraciones.versat_user is 'Usuario Basic Auth API VERSAT';
comment on column integraciones.versat_password is 'Contraseña Basic Auth (preferir Vault en prod)';
