-- The morning stats sync, scheduled in the database. The jobs sign their calls with a random key
-- the database generates for itself and keeps in the vault, so no person ever handles it; the app
-- checks it through sync_token_ok(), which only the service role can call.
SELECT vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'war_room_sync_token',
  'Bearer key for the scheduled /api/public/cron/sync calls'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'war_room_sync_token');

CREATE OR REPLACE FUNCTION public.sync_token_ok(_token text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'war_room_sync_token' AND decrypted_secret = _token
  )
$$;
REVOKE EXECUTE ON FUNCTION public.sync_token_ok(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_token_ok(text) TO service_role;

-- 12:45 and 12:50 UTC (overnight games are final by then): the pool's game logs in two halves,
-- each call rebuilding the daily totals
SELECT cron.schedule('war-room-sync-a', '45 12 * * *', $job$
  SELECT net.http_post(
    url := 'https://war-room-hockey.lovable.app/api/public/cron/sync?offset=0&limit=80',
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
    url := 'https://war-room-hockey.lovable.app/api/public/cron/sync?offset=80&limit=200',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'war_room_sync_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
