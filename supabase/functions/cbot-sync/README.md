# cbot-sync

Edge Function que sincroniza cotizaciones CBOT desde Yahoo Finance (equivalente a yfinance). Inserta **1 registro por cultura/día** en la tabla `cbot`.

- **Fuente:** Yahoo Finance API (símbolos ZS=F soja, ZC=F maíz, ZW=F trigo).
- **Cálculos en la app:** Siempre usar el **último registro válido** por cultura (`order by created_at desc limit 1`).

## Despliegue

```bash
supabase functions deploy cbot-sync
```

## Cron: 08:00 America/Asuncion

**Horario:** 12:00 UTC = 08:00 America/Asuncion → expresión cron: `0 12 * * *`.

**Opción A – pg_cron + pg_net (recomendado):**

1. Habilitar extensiones `pg_cron` y `pg_net` en el proyecto.
2. En **Vault**, crear secretos: `project_url` (ej. `https://<ref>.supabase.co`) y `anon_key` (tu anon key).
3. Ejecutar el SQL en `supabase/migrations/20260305080000_cron_cbot_sync.sql` (descomentar el bloque `cron.schedule`).

**Opción B – Dashboard:** Si tu proyecto tiene **Integrations → Cron → Jobs**, crear un job que haga POST a la URL de la función a las 12:00 UTC.

**Prueba manual:**

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/cbot-sync" \
  -H "Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_ROLE_KEY>"
```

## Respuesta

- `200`: `{ "ok": true, "date": "YYYY-MM-DD", "inserted": [{ "codigo": "soja", "cierre": 1171 }, ...], "errors": [] }`
- `500`: error de configuración o de lectura de culturas.
