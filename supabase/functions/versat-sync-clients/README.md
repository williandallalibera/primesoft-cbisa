# versat-sync-clients

Edge Function que sincroniza clientes desde VERSAT (recurso RC31) hacia la tabla `clientes`.

- **Recurso:** RC31 (Polling/Data).
- **Config:** Misma que productos: `integraciones.versat_base_url`, `versat_empresa_id`, `versat_user`, `versat_password`.
- **Upsert:** Por `id_versat`. Campos mapeados: nombre, ruc, ci, telefono, direccion, email, estado.

## Despliegue

```bash
supabase functions deploy versat-sync-clients
```

## Prueba manual

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/versat-sync-clients" \
  -H "Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_ROLE_KEY>"
```
