# Primesoft CBISA

Sistema de gestão e monitoramento agrícola para a CBISA (Paraguai): clientes, produtos, parcelas, zafras, propuestas, vouchers, monitoreo (siembra, aplicaciones, evaluaciones, cosecha, RTE), agente de IA y espacio del cliente.

- **Frontend:** React + Vite + TypeScript + AdminLTE/Bootstrap
- **Backend:** Supabase (Auth, Database, Storage)

## Cómo ejecutar en local

1. **Clonar e instalar dependências**
   ```bash
   git clone <url-del-repo>
   cd primesoft-cbisa
   npm install
   ```

2. **Configurar Supabase**
   - Crear proyecto en [supabase.com](https://supabase.com).
   - En **SQL Editor**, ejecutar todo el contenido de `db/schema.sql`.
   - Crear un usuario en **Authentication > Users** y vincularlo en la tabla `usuarios` con perfil `admin` (ver `docs/SUPABASE.md`).

3. **Variables de entorno**
   ```bash
   cp .env.example .env
   ```
   Editar `.env` y completar con la **Project URL** y la **anon key** de Supabase (Project Settings > API).

4. **Arrancar**
   ```bash
   npm run dev
   ```
   Abrir la URL que muestre Vite (por ejemplo `http://localhost:5173`).

## ¿No funcionó?

- **La página en blanco o errores al cargar:** asegúrese de haber ejecutado `npm install` y de tener Node.js instalado (v18 o superior).
- **"Configuración pendiente" en el login:** cree el archivo `.env` en la raíz del proyecto (copie `.env.example`) y complete `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores de su proyecto en Supabase (Project Settings > API).
- **El login no inicia sesión:** verifique que en Supabase haya ejecutado todo el `db/schema.sql` y que exista un usuario en Authentication vinculado en la tabla `usuarios` con `perfil_acceso = 'admin'` (ver `docs/SUPABASE.md`).
- **Puerto 5173 en uso:** Vite usará otro puerto (ej. 5174); revise la URL que aparece en la terminal.

## Deploy en Vercel

1. Subir el código a un repositorio en **GitHub**.
2. En [vercel.com](https://vercel.com), **Add New Project** e importar el repo.
3. En **Settings > Environment Variables** del proyecto en Vercel, agregar:
   - `VITE_SUPABASE_URL` = URL del proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon public key de Supabase
4. Deploy. El comando de build por defecto (`npm run build`) y el directorio de salida (`dist`) son los que usa Vite.

## Documentación

- **Supabase (tablas, primer usuario, env):** ver `docs/SUPABASE.md`.

## Idioma y moneda

- Interfaz en **español (Paraguay)**.
- Montos en **USD**.
