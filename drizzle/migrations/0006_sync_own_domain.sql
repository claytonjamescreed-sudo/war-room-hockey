-- The site has its own domain, https://wghockeypool.com; wg-hockey-pool.lovable.app (and www.)
-- now answer with a redirect to it. A redirect to another host can drop the jobs' Authorization
-- header, so point the two morning sync jobs straight at the domain. cron.schedule with a job's
-- existing name replaces that job: same names, same times, same signing key as migration 0003.
SELECT cron.schedule('war-room-sync-a', '45 12 * * *', $job$
  SELECT net.http_post(
    url := 'https://wghockeypool.com/api/public/cron/sync?offset=0&limit=80',
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
    url := 'https://wghockeypool.com/api/public/cron/sync?offset=80&limit=200',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'war_room_sync_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
