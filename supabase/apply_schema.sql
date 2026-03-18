-- Schema Primesoft CBISA - Supabase
-- Todas as tabelas com id UUID (default gen_random_uuid()), created_at, updated_at

create extension if not exists "uuid-ossp";

-- =========================
-- Tabelas de suporte genéricas
-- =========================

create table if not exists estado_registro (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists perfiles_acceso (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- admin, rtv, cliente
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- Usuários, clientes
-- =========================

create table if not exists usuarios (
  id uuid primary key, -- referencia auth.users.id
  nombre text,
  ci text,
  telefono text,
  email text,
  perfil_acceso text not null, -- admin, rtv, cliente
  estado text not null default 'activo', -- activo, inactivo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_usuarios_perfil on usuarios (perfil_acceso);
create index if not exists idx_usuarios_estado on usuarios (estado);

create table if not exists tipo_persona (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- fisica, juridica
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists estado_civil (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  id_versat bigint unique,
  id_usuario_auth uuid references auth.users(id),
  id_vendedor uuid references usuarios(id),
  id_tipo_persona uuid references tipo_persona(id),
  ci text,
  ruc text,
  nombre text not null,
  fecha_nacimiento date,
  id_estado_civil uuid references estado_civil(id),
  telefono text,
  direccion text,
  email text,
  nombre_contador text,
  telefono_contador text,
  fecha_inicio date,
  area_propia_ha numeric(18,3) default 0,
  area_alquilada_ha numeric(18,3) default 0,
  archivo_ci_url text,
  estado text not null default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clientes_nombre on clientes (nombre);
create index if not exists idx_clientes_estado on clientes (estado);
create index if not exists idx_clientes_vendedor on clientes (id_vendedor);

-- =========================
-- Tabelas de constantes agronômicas
-- =========================

create table if not exists culturas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- soja, maiz, trigo
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists categorias_producto (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists unidades_medida (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- L, KG, ML, G
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tipo_propuesta (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- presupuesto, venta
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists estado_propuesta (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- vigente, cancelado
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tipo_aplicacion (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- terrestre, aerea
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists destinos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists etapas_fenologicas (
  id uuid primary key default gen_random_uuid(),
  id_cultura uuid not null references culturas(id),
  codigo text not null,
  descripcion text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (id_cultura, codigo)
);

create table if not exists vigor (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists plagas (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists enfermedades (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists malezas (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists estres_hidrico (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists clima_reciente (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fitotoxicidad (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- Seeds para tabelas de lookup
-- =========================

insert into estado_registro (codigo, descripcion)
values ('activo', 'Activo'), ('inactivo', 'Inactivo')
on conflict (codigo) do nothing;

insert into perfiles_acceso (codigo, descripcion)
values ('admin', 'Administrador'), ('rtv', 'RTV'), ('cliente', 'Cliente')
on conflict (codigo) do nothing;

insert into tipo_persona (codigo, descripcion)
values ('fisica', 'Persona física'), ('juridica', 'Persona jurídica')
on conflict (codigo) do nothing;

insert into estado_civil (codigo, descripcion)
values
  ('soltero', 'Soltero'),
  ('casado', 'Casado'),
  ('divorciado', 'Divorciado')
on conflict (codigo) do nothing;

insert into culturas (codigo, descripcion)
values ('soja', 'Soja'), ('maiz', 'Maíz'), ('trigo', 'Trigo')
on conflict (codigo) do nothing;

insert into unidades_medida (codigo, descripcion)
values
  ('L', 'Litro'),
  ('KG', 'Kilogramo'),
  ('ML', 'Mililitro'),
  ('G', 'Gramo'),
  ('UN', 'Unidad')
on conflict (codigo) do nothing;

insert into tipo_propuesta (codigo, descripcion)
values ('presupuesto', 'Presupuesto'), ('venta', 'Venta')
on conflict (codigo) do nothing;

insert into estado_propuesta (codigo, descripcion)
values ('vigente', 'Vigente'), ('cancelado', 'Cancelado')
on conflict (codigo) do nothing;

insert into tipo_aplicacion (codigo, descripcion)
values ('terrestre', 'Aplicación terrestre'), ('aerea', 'Aplicación aérea')
on conflict (codigo) do nothing;

insert into categorias_producto (codigo, descripcion)
values
  ('otros_insumos', 'Otros insumos agrícolas'),
  ('bioestimulantes', 'Bioestimulantes'),
  ('insecticidas', 'Insecticidas'),
  ('semillas', 'Semillas'),
  ('herbicidas', 'Herbicidas'),
  ('fungicidas', 'Fungicidas'),
  ('cura_semillas', 'Cura semillas'),
  ('fertilizantes_foliares', 'Fertilizantes foliares'),
  ('fertilizantes', 'Fertilizantes'),
  ('packs', 'Packs'),
  ('calcareo', 'Calcareo'),
  ('inoculantes', 'Inoculantes'),
  ('biologicos', 'Biológicos'),
  ('adyuvantes', 'Adyuvantes')
on conflict (codigo) do nothing;

insert into destinos (nombre)
values
  ('Lar'),
  ('Diagro'),
  ('ADM'),
  ('Coopasam'),
  ('Cargill'),
  ('Ovetril'),
  ('Agro Santa Rosa'),
  ('Colonias Unidas'),
  ('CPA Pindó'),
  ('CPA Yguazu'),
  ('C. Vale'),
  ('Somax'),
  ('Glimax'),
  ('IASA'),
  ('Agrofértil'),
  ('Agrotec'),
  ('Sul América'),
  ('Centro del Agro'),
  ('Otro')
on conflict (nombre) do nothing;

insert into vigor (descripcion)
values
  ('Muy bueno'),
  ('Bueno'),
  ('Regular'),
  ('Bajo'),
  ('Muy bajo')
on conflict (descripcion) do nothing;

insert into estres_hidrico (descripcion)
values
  ('Ausente'),
  ('Leve'),
  ('Moderado'),
  ('Severo')
on conflict (descripcion) do nothing;

insert into clima_reciente (descripcion)
values
  ('Lluvia adecuada'),
  ('Exceso de lluvia'),
  ('Falta de lluvia'),
  ('Alta humedad'),
  ('Temperaturas elevadas'),
  ('Temperaturas bajas'),
  ('Vientos fuertes'),
  ('Granizo reciente')
on conflict (descripcion) do nothing;

insert into fitotoxicidad (descripcion)
values
  ('Ninguna'),
  ('Leve'),
  ('Moderada'),
  ('Severa')
on conflict (descripcion) do nothing;

-- Etapas fenológicas Soja
with soja as (
  select id from culturas where codigo = 'soja'
),
maiz as (
  select id from culturas where codigo = 'maiz'
),
trigo as (
  select id from culturas where codigo = 'trigo'
)
insert into etapas_fenologicas (id_cultura, codigo, descripcion)
select soja.id, x.codigo, x.descripcion
from soja,
  (values
    ('VE', 'Emergencia'),
    ('VC', 'Cotiledonar'),
    ('V1', 'Primer nudo'),
    ('V2', 'Segundo nudo'),
    ('V3', 'Tercer nudo'),
    ('V4', 'Cuarto nudo'),
    ('V5', 'Quinto nudo'),
    ('V6', 'Sexto nudo'),
    ('R1', 'Inicio de floración'),
    ('R2', 'Floración plena'),
    ('R3', 'Inicio de formación de vainas'),
    ('R4', 'Vaina completamente formada'),
    ('R5', 'Inicio de llenado de granos'),
    ('R6', 'Grano lleno'),
    ('R7', 'Inicio de madurez'),
    ('R8', 'Madurez plena')
  ) as x(codigo, descripcion)
on conflict (id_cultura, codigo) do nothing;

-- Etapas fenológicas Maíz
insert into etapas_fenologicas (id_cultura, codigo, descripcion)
select c.id, x.codigo, x.descripcion
from (select id from culturas where codigo = 'maiz') c,
  (values
    ('VE', 'Emergencia'),
    ('V2', 'V2'),
    ('V4', 'V4'),
    ('V6', 'V6'),
    ('V8', 'V8'),
    ('VT', 'Panojamiento'),
    ('R1', 'Floración'),
    ('R2', 'Grano lechoso'),
    ('R3', 'Grano pastoso'),
    ('R4', 'Grano duro'),
    ('R5', 'Dentado'),
    ('R6', 'Madurez fisiológica')
  ) as x(codigo, descripcion)
on conflict (id_cultura, codigo) do nothing;

-- Etapas fenológicas Trigo
insert into etapas_fenologicas (id_cultura, codigo, descripcion)
select c.id, x.codigo, x.descripcion
from (select id from culturas where codigo = 'trigo') c,
  (values
    ('E', 'Emergencia'),
    ('M', 'Macollaje'),
    ('EN', 'Encañado'),
    ('HB', 'Hoja bandera'),
    ('ES', 'Espigazón'),
    ('F', 'Floración'),
    ('GL', 'Grano lechoso'),
    ('GP', 'Grano pastoso'),
    ('MD', 'Madurez')
  ) as x(codigo, descripcion)
on conflict (id_cultura, codigo) do nothing;

insert into plagas (descripcion)
values
  ('Oruga cogollera (Spodoptera)'),
  ('Oruga falsa medidora'),
  ('Oruga de la soja'),
  ('Chinche verde'),
  ('Chinche barriga verde'),
  ('Mosca blanca'),
  ('Trips'),
  ('Ácaros'),
  ('Pulgones'),
  ('Gusano barrenador'),
  ('Otras')
on conflict (descripcion) do nothing;

insert into enfermedades (descripcion)
values
  ('Roya asiática'),
  ('Mancha objetivo'),
  ('Oídio'),
  ('Antracnosis'),
  ('Mancha marrón'),
  ('Septoriosis'),
  ('Podredumbre radicular'),
  ('Nematodos'),
  ('Moho blanco (soja)'),
  ('Tizón foliar (maíz)'),
  ('Roya del trigo'),
  ('Fusariosis'),
  ('Carbón del maíz'),
  ('Otras')
on conflict (descripcion) do nothing;

insert into malezas (descripcion)
values
  ('Buva (Conyza)'),
  ('Capim amargoso (Sorgo de Alepo)'),
  ('Capim pé de gallina'),
  ('Brachiaria'),
  ('Capim colonião'),
  ('Yuyo colorado (Amaranto)'),
  ('Picão preto'),
  ('Corda de viola'),
  ('Lecherón'),
  ('Trapoeraba'),
  ('Otras')
on conflict (descripcion) do nothing;

-- =========================
-- Ajustes / Empresa / CBOT / Integraciones
-- =========================

create table if not exists empresa (
  id uuid primary key default gen_random_uuid(),
  ruc text,
  direccion text,
  telefono text,
  logo_url text,
  logo_informes_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists cbot (
  id uuid primary key default gen_random_uuid(),
  id_cultura uuid not null references culturas(id),
  vencimiento date,
  ctr text,
  cierre numeric(18,3),
  simulacion numeric(18,3),
  variacion numeric(18,3),
  alto numeric(18,3),
  bajo numeric(18,3),
  apertura numeric(18,3),
  costo numeric(18,3),
  precio_bolsa_simulacion numeric(18,3),
  precio_bolsa numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cbot_cultura_fecha on cbot (id_cultura, created_at desc);

create table if not exists integraciones (
  id uuid primary key default gen_random_uuid(),
  api_google_maps text,
  api_openai text,
  costo_cbot_soja numeric(18,3) default 110,
  versat_base_url text,
  versat_empresa_id integer,
  versat_user text,
  versat_password text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- Productos
-- =========================

create table if not exists distribuidores (
  id uuid primary key default gen_random_uuid(),
  fabricante text not null,
  distribuidor text not null,
  estado text not null default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_distribuidores_estado on distribuidores (estado);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  id_versat bigint unique,
  sku text not null unique,
  id_categoria uuid references categorias_producto(id),
  nombre text not null,
  fabricante text,
  culturas uuid[] default '{}', -- ids de culturas
  composicion text,
  id_unidad_medida uuid references unidades_medida(id),
  contenido_empaque numeric(18,3),
  presentacion_txt text,
  estado text not null default 'activo',
  -- composición de precio
  precio_compra numeric(18,3),
  margen numeric(18,3),
  precio_venta numeric(18,3),
  costo_operacional numeric(18,3),
  costo_financiero numeric(18,3),
  bonificacion_vendedor numeric(18,3),
  bonificacion_cliente numeric(18,3),
  voucher numeric(18,3),
  impacto_total_costo numeric(18,3),
  precio_final numeric(18,3),
  precio_minimo numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_productos_nombre on productos (nombre);
create index if not exists idx_productos_estado on productos (estado);

-- =========================
-- CRM / Propuestas / Vouchers
-- =========================

create table if not exists propuestas (
  id uuid primary key default gen_random_uuid(),
  sku text,
  id_cliente uuid not null references clientes(id),
  id_tipo_propuesta uuid references tipo_propuesta(id),
  fecha date not null default current_date,
  id_vendedor uuid references usuarios(id),
  total_items integer default 0,
  total_voucher numeric(18,3) default 0,
  total_en_bolsas numeric(18,3) default 0,
  total_general numeric(18,3) default 0,
  id_estado_propuesta uuid references estado_propuesta(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_propuestas_cliente on propuestas (id_cliente);
create index if not exists idx_propuestas_vendedor on propuestas (id_vendedor);
create index if not exists idx_propuestas_fecha on propuestas (fecha);

create table if not exists productos_propuesta (
  id uuid primary key default gen_random_uuid(),
  id_propuesta uuid not null references propuestas(id) on delete cascade,
  id_producto uuid not null references productos(id),
  id_distribuidor uuid references distribuidores(id),
  categoria text,
  unidad_medida text,
  contenido_empaque numeric(18,3),
  voucher numeric(18,3),
  precio_minimo numeric(18,3),
  precio_producto numeric(18,3),
  cantidad numeric(18,3),
  num_aplicaciones integer,
  dosis_ha numeric(18,3),
  area_tratada numeric(18,3),
  costo_ha numeric(18,3),
  importe_total numeric(18,3),
  -- snapshot de composición de precio
  precio_compra_base numeric(18,3),
  margen_base numeric(18,3),
  costo_operacional_base numeric(18,3),
  costo_financiero_base numeric(18,3),
  bonificacion_vendedor_base numeric(18,3),
  bonificacion_cliente_base numeric(18,3),
  impacto_total_costo_base numeric(18,3),
  precio_final_base numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_productos_propuesta_propuesta on productos_propuesta (id_propuesta);

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  id_cliente uuid not null references clientes(id),
  valor_total_generado numeric(18,3) default 0,
  valor_total_liberado numeric(18,3) default 0,
  valor_restante numeric(18,3) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (id_cliente)
);

create table if not exists movimiento_vouchers (
  id uuid primary key default gen_random_uuid(),
  id_voucher uuid not null references vouchers(id),
  id_cliente uuid not null references clientes(id),
  id_propuesta uuid references propuestas(id),
  fecha timestamptz not null default now(),
  valor_generado numeric(18,3),
  valor_liberado numeric(18,3),
  porcentaje_liberado numeric(18,3),
  tipo text not null, -- generado, liberado, cancelado
  id_usuario uuid references usuarios(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_mov_vouchers_cliente on movimiento_vouchers (id_cliente);
create index if not exists idx_mov_vouchers_fecha on movimiento_vouchers (fecha);

-- =========================
-- Parcelas e Zafras
-- =========================

create table if not exists parcelas (
  id uuid primary key default gen_random_uuid(),
  id_cliente uuid not null references clientes(id),
  nombre_parcela text not null,
  localidad text,
  area_prevista_ha numeric(18,3),
  area_real_ha numeric(18,3),
  estado text not null default 'activo',
  geom jsonb, -- GeoJSON do polígono
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_parcelas_cliente on parcelas (id_cliente);
create index if not exists idx_parcelas_estado on parcelas (estado);

create table if not exists zafras (
  id uuid primary key default gen_random_uuid(),
  nombre_zafra text not null,
  ciclo integer,
  id_cultura uuid references culturas(id),
  estado text not null default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- Monitoreo e etapas
-- =========================

create table if not exists monitoreos (
  id uuid primary key default gen_random_uuid(),
  id_cliente uuid not null references clientes(id),
  id_parcela uuid not null references parcelas(id),
  id_zafra uuid not null references zafras(id),
  hectares numeric(18,3),
  costo_estimado numeric(18,3),
  productividad_estimada numeric(18,3),
  estado_etapa_actual text default 'planificacion',
  tiene_siembra boolean default false,
  tiene_aplicaciones boolean default false,
  tiene_evaluaciones boolean default false,
  tiene_cosecha boolean default false,
  tiene_rte boolean default false,
  concluido boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_monitoreos_cliente on monitoreos (id_cliente);
create index if not exists idx_monitoreos_parcela on monitoreos (id_parcela);

create table if not exists siembra (
  id uuid primary key default gen_random_uuid(),
  id_monitoreo uuid not null references monitoreos(id),
  fecha_inicio date,
  fecha_termino date,
  costo_total numeric(18,3),
  costo_ha numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_siembra_monitoreo_uniq on siembra (id_monitoreo);

create table if not exists siembra_productos (
  id uuid primary key default gen_random_uuid(),
  id_siembra uuid not null references siembra(id) on delete cascade,
  id_producto uuid not null references productos(id),
  categoria text,
  cantidad numeric(18,3),
  dosis_ha numeric(18,3),
  importe_total numeric(18,3),
  costo_ha numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_siembra_productos_siembra on siembra_productos (id_siembra);

create table if not exists aplicaciones (
  id uuid primary key default gen_random_uuid(),
  id_monitoreo uuid not null references monitoreos(id),
  fecha_aplicacion date,
  id_tipo_aplicacion uuid references tipo_aplicacion(id),
  rendimiento_tanque_ha numeric(18,3),
  capacidad_tanque_litros numeric(18,3),
  costo_total numeric(18,3),
  costo_ha numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_aplicaciones_monitoreo on aplicaciones (id_monitoreo);

create table if not exists aplicacion_productos (
  id uuid primary key default gen_random_uuid(),
  id_aplicacion uuid not null references aplicaciones(id) on delete cascade,
  id_producto uuid not null references productos(id),
  categoria text,
  cantidad numeric(18,3),
  dosis_ha numeric(18,3),
  importe_total numeric(18,3),
  costo_ha numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_aplicacion_productos_aplicacion on aplicacion_productos (id_aplicacion);

create table if not exists evaluaciones (
  id uuid primary key default gen_random_uuid(),
  id_monitoreo uuid not null references monitoreos(id),
  fecha_evaluacion date not null,
  id_etapa_fenologica uuid references etapas_fenologicas(id),
  id_vigor uuid references vigor(id),
  id_estres_hidrico uuid references estres_hidrico(id),
  id_fitotoxicidad uuid references fitotoxicidad(id),
  id_clima_reciente uuid references clima_reciente(id),
  descripcion_general text,
  imagen_1_url text,
  imagen_2_url text,
  imagen_3_url text,
  fecha_proxima_evaluacion date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_evaluaciones_monitoreo on evaluaciones (id_monitoreo);
create index if not exists idx_evaluaciones_fecha on evaluaciones (fecha_evaluacion);
create index if not exists idx_evaluaciones_proxima on evaluaciones (fecha_proxima_evaluacion);

-- Relações N:N de evaluaciones com listas de plagas/enfermedades/malezas

create table if not exists evaluacion_plagas (
  id uuid primary key default gen_random_uuid(),
  id_evaluacion uuid not null references evaluaciones(id) on delete cascade,
  id_plaga uuid not null references plagas(id)
);

create table if not exists evaluacion_enfermedades (
  id uuid primary key default gen_random_uuid(),
  id_evaluacion uuid not null references evaluaciones(id) on delete cascade,
  id_enfermedad uuid not null references enfermedades(id)
);

create table if not exists evaluacion_malezas (
  id uuid primary key default gen_random_uuid(),
  id_evaluacion uuid not null references evaluaciones(id) on delete cascade,
  id_maleza uuid not null references malezas(id)
);

create table if not exists cosechas (
  id uuid primary key default gen_random_uuid(),
  id_monitoreo uuid not null references monitoreos(id),
  fecha_inicio date,
  fecha_termino date,
  resultado_liquido_kg numeric(18,3),
  productividad_bolsas_alq numeric(18,3),
  humedad numeric(18,3),
  costo_bolsa numeric(18,3),
  costo_total numeric(18,3),
  id_destino uuid references destinos(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_cosechas_monitoreo_uniq on cosechas (id_monitoreo);

create table if not exists rte (
  id uuid primary key default gen_random_uuid(),
  id_monitoreo uuid not null references monitoreos(id),
  costo_total numeric(18,3),
  ingreso_total numeric(18,3),
  resultado_tecnico numeric(18,3),
  otros_costos numeric(18,3) default 0,
  rendimiento_actual numeric(18,3),
  precio_venta numeric(18,3),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_rte_monitoreo_uniq on rte (id_monitoreo);

-- =========================
-- IA / Chat
-- =========================

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references usuarios(id),
  titulo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_chats_usuario on chats (id_usuario);

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  id_chat uuid not null references chats(id) on delete cascade,
  role text not null, -- user, ia, sistema
  contenido text not null,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_mensajes_chat on mensajes (id_chat, created_at);

-- =========================
-- Trigger: actualizar updated_at al modificar (opcional)
-- =========================
create or replace function actualizar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- Supabase: FK usuarios -> auth.users + trigger nuevo usuario + RLS
-- =========================

-- Vincular usuarios.id con auth.users (permite trigger al registrar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_auth_fk') THEN
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_auth_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Crear perfil en public.usuarios cuando alguien se registra en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, perfil_acceso)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(NEW.email, ''),
    'cliente'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: usuários autenticados podem ler/escrever em todas as tabelas (refinar depois por perfil)
DO $$
DECLARE
  t text;
  tbls text[] := array[
    'estado_registro','perfiles_acceso','usuarios','tipo_persona','estado_civil','clientes',
    'culturas','categorias_producto','unidades_medida','tipo_propuesta','estado_propuesta',
    'tipo_aplicacion','destinos','etapas_fenologicas','vigor','plagas','enfermedades','malezas',
    'estres_hidrico','clima_reciente','fitotoxicidad','empresa','cbot','integraciones',
    'distribuidores','productos','propuestas','productos_propuesta','vouchers','movimiento_vouchers',
    'parcelas','zafras','monitoreos','siembra','siembra_productos','aplicaciones','aplicacion_productos',
    'evaluaciones','evaluacion_plagas','evaluacion_enfermedades','evaluacion_malezas','cosechas','rte',
    'chats','mensajes'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_authenticated" ON public.%I', t);
    EXECUTE format('CREATE POLICY "allow_authenticated" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

