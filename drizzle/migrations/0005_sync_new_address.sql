-- The site moved from war-room-hockey.lovable.app to wg-hockey-pool.lovable.app when it was renamed
-- WG Hockey Pool, and the old address stopped answering (404). The two morning sync jobs call the
-- site by its address, so point them at the new one. cron.schedule with a job's existing name
-- replaces that job: same names, same times, same signing key as migration 0003.
SELECT cron.schedule('war-room-sync-a', '45 12 * * *', $job$
  SELECT net.http_post(
    url := 'https://wg-hockey-pool.lovable.app/api/public/cron/sync?offset=0&limit=80',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'war_room_sync_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
SELECT cron.schedule('war-room-sync-b', '50 12 * * *', $job$
  SELECT net.http_post(
    url := 'https://wg-hockey-pool.lovable.app/api/public/cron/sync?offset=80&limit=200',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'war_room_sync_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
