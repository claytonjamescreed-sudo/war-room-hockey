import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Pulls every pool player's game log from NHL.com into player_games, then saves each team's
// season total per date into daily_totals (backfills every date since count_from).
// ?offset=&limit= lets the caller split the NHL fetches into smaller batches.
export const Route = createFileRoute("/api/public/cron/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
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
