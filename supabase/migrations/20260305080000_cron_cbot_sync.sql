-- Cron: ejecutar Edge Function cbot-sync todos los días a las 08:00 America/Asuncion (12:00 UTC).
-- La función lee el costo desde integraciones.costo_cbot_soja (configurable en Ajustes → CBOT → Guardar costo).
-- Requiere extensiones: pg_cron, pg_net. Guardar en Vault: project_url y anon_key (o service_role para mayor seguridad).
--
-- 1) En el Dashboard: Vault → crear secretos (una vez):
--    project_url = https://<PROJECT_REF>.supabase.co
--    anon_key    = tu SUPABASE_ANON_KEY (o service_role para invocar la función)
--
-- 2) Ejecutar este bloque (opcional; si ya tienes otros crons, adapta el nombre 'cbot-sync-daily'):


select cron.schedule(
  'cbot-sync-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/cbot-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);


-- Para eliminar el cron más adelante:
-- select cron.unschedule('cbot-sync-daily');
