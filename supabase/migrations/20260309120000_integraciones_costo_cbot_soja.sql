-- Costo soja CBOT dinámico: tonelada = (bushel × 0,367454) − costo; se guarda en integraciones.
alter table integraciones
  add column if not exists costo_cbot_soja numeric(18,3) default 110;

comment on column integraciones.costo_cbot_soja is 'Costo por tonelada (se resta en fórmula CBOT soja). Usado por cron y sync.';
