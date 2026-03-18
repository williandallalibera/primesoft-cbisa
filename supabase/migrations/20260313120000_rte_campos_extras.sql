-- RTE: campos editables para persistir otros costos, rendimiento y precio de venta
alter table rte
  add column if not exists otros_costos numeric(18,3) default 0,
  add column if not exists rendimiento_actual numeric(18,3),
  add column if not exists precio_venta numeric(18,3);

comment on column rte.otros_costos is 'Otros costos (maquinaria, mano de obra) editables por el usuario.';
comment on column rte.rendimiento_actual is 'Rendimiento en kg (total o por ha según uso). Por defecto desde cosecha.';
comment on column rte.precio_venta is 'Precio de venta USD. Por defecto desde CBOT según cultura de la zafra.';
