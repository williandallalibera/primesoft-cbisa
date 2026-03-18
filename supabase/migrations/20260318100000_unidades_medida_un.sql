-- Unidad "UN" (Unidad/Bolsas) para presentaciones VERSAT sin L/KG/ML/G.
insert into unidades_medida (codigo, descripcion)
values ('UN', 'Unidad')
on conflict (codigo) do nothing;
