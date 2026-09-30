import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Pulls every pool player's game log from NHL.com into player_games, then saves each team's
// season total per date into daily_totals (backfills every date since count_from).
// ?offset=&limit= lets the caller split the NHL fetches into smaller batches.

// The database's scheduled jobs sign with their own vault key (checked by sync_token_ok, see
// migration 0003); anything else needs the platform cron secret.
async function denied(request: Request) {
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (token) {
    const { adminClient } = await import("@/lib/sync.server");
    const { data } = await (await adminClient()).rpc("sync_token_ok", { _token: token });
    if (data === true) return null;
  }
  return authenticateCronRequest(request);
}

export const Route = createFileRoute("/api/public/cron/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const refused = await denied(request);
        if (refused) return refused;
        const url = new URL(request.url);
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
        const limit = Math.min(
          200,
          Math.max(1, Number(url.searchParams.get("limit") ?? 200) || 200),
        );
        const totalsOnly = url.searchParams.get("totals") === "only";

        const { adminClient, syncGameLogs, rebuildDailyTotals } = await import("@/lib/sync.server");
        const { loadLeague } = await import("@/lib/league.server");
        const sb = await adminClient();
        const { ids } = await loadLeague(sb);

        let synced = 0;
        try {
          if (!totalsOnly) synced = await syncGameLogs(sb, ids.slice(offset, offset + limit));
          const result = await rebuildDailyTotals(sb);
          return Response.json({ ok: true, synced, ...result });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
