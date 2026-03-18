-- Aplicaciones: capacidad del tanque en litros para cálculo operacional
alter table aplicaciones
  add column if not exists capacidad_tanque_litros numeric(18,3);

comment on column aplicaciones.capacidad_tanque_litros is 'Capacidad del tanque en litros. Con rendimiento_tanque_ha permite calcular tanques necesarios y volumen total de calda.';
