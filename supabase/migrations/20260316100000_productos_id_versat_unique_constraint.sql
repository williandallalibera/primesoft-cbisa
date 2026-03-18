-- ON CONFLICT (id_versat) requiere una constraint UNIQUE explícita;
-- el índice único parcial no siempre es reconocido por el upsert.

drop index if exists idx_productos_id_versat;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'productos_id_versat_key' and conrelid = 'productos'::regclass
  ) then
    alter table productos add constraint productos_id_versat_key unique (id_versat);
  end if;
end $$;
