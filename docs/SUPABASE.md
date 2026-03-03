# Configuración Supabase – Primesoft CBISA

## 1. Crear proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto (o usa uno existente).
2. En **Project Settings > API** anota:
   - **Project URL** → usar como `VITE_SUPABASE_URL`
   - **anon public** key → usar como `VITE_SUPABASE_ANON_KEY`

## 2. Ejecutar el schema (tablas y datos iniciales)

1. En el dashboard de Supabase, abre **SQL Editor**.
2. Crea una nueva query y pega **todo** el contenido del archivo `db/schema.sql` del repositorio.
3. Ejecuta la query (Run).  
   - Si aparece algún error de “relation already exists”, puedes ignorarlo en una segunda ejecución (el script usa `create table if not exists` y `on conflict do nothing` donde aplica).

Con eso quedan creadas:

- Extensiones y tablas de soporte (estado_registro, perfiles_acceso, tipo_persona, estado_civil, culturas, categorias_producto, unidades_medida, etc.)
- Tablas de negocio: usuarios, clientes, empresa, cbot, integraciones, distribuidores, productos, propuestas, productos_propuesta, vouchers, movimiento_vouchers, parcelas, zafras, monitoreos, siembra, siembra_productos, aplicaciones, aplicacion_productos, evaluaciones, cosechas, rte, chats, mensajes
- Datos iniciales (seeds) para dropdowns: culturas, categorías de producto, etapas fenológicas, destinos, plagas, enfermedades, malezas, etc.
- Función `actualizar_updated_at()` para triggers opcionales de `updated_at`

## 3. Autenticación y primer usuario Admin

1. En Supabase: **Authentication > Users** → **Add user** (o **Invite**).
2. Crea un usuario con email y contraseña (este será tu primer admin).
3. En **SQL Editor** ejecuta (reemplaza `TU-USER-ID` por el **UUID** del usuario que acabas de crear, visible en Authentication > Users):

```sql
insert into usuarios (id, nombre, email, perfil_acceso, estado)
values (
  'TU-USER-ID',
  'Admin',
  'tu-email@ejemplo.com',
  'admin',
  'activo'
)
on conflict (id) do update set
  nombre = excluded.nombre,
  perfil_acceso = excluded.perfil_acceso,
  estado = excluded.estado;
```

Así ese usuario queda como **admin** en la app.

## 4. Variables de entorno (local y Vercel)

- **Local:** copia `.env.example` a `.env` y rellena con la URL y la anon key de tu proyecto.
- **Vercel:** en el proyecto de Vercel, **Settings > Environment Variables** y agrega:
  - `VITE_SUPABASE_URL` = (tu Project URL de Supabase)
  - `VITE_SUPABASE_ANON_KEY` = (tu anon public key de Supabase)

**Importante:** No subas las claves al repositorio. Usa solo `.env` en local (ya está en `.gitignore`) y las variables en el panel de Vercel.

Con eso la app (local y en Vercel) usará el mismo proyecto Supabase.

## 5. (Opcional) Row Level Security (RLS)

Para restringir por perfil (admin/rtv/cliente) puedes activar RLS en las tablas y crear políticas. En `db/schema.sql` hay ejemplos comentados al final. Puedes activarlos y adaptarlos según tu lógica de perfiles.

## 6. Storage (opcional)

Si más adelante usas **Archivo CI** en clientes o imágenes en evaluaciones, crea en Supabase un bucket (por ejemplo `documentos`) y configura políticas de acceso según quién pueda subir/ver archivos.
