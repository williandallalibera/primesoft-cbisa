-- Cron: ejecutar Edge Function versat-sync-products 2 veces al día (06:00 y 18:00 America/Asuncion).
-- 10:00 UTC = 06:00 America/Asuncion; 22:00 UTC = 18:00 America/Asuncion.
-- Requiere Vault: project_url, anon_key (igual que cbot-sync).

select cron.schedule(
  'versat-sync-products-morning',
  '0 10 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/versat-sync-products',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'versat-sync-products-evening',
  '0 22 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/versat-sync-products',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Para eliminar:
-- select cron.unschedule('versat-sync-products-morning');
-- select cron.unschedule('versat-sync-products-evening');
