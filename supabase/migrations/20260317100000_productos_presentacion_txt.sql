-- Guardar texto de presentación VERSAT (ej. "20 L", "Bolsas 40") para mostrar en UI y cálculos.
alter table productos
  add column if not exists presentacion_txt text;

comment on column productos.presentacion_txt is 'Texto de presentación del producto (VERSAT Presentacion_txt).';
