-- VERSAT: clientes.id_versat para sync RC31 (misma idea que productos).
alter table clientes
  add column if not exists id_versat bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_id_versat_key' and conrelid = 'clientes'::regclass
  ) then
    alter table clientes add constraint clientes_id_versat_key unique (id_versat);
  end if;
end $$;

comment on column clientes.id_versat is 'ID del cliente en VERSAT (RC31). Null = cliente manual.';
