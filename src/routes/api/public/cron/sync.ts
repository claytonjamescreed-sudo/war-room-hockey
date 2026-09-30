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
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 200) || 200));
        const totalsOnly = url.searchParams.get("totals") === "only";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadLeague, loadLogs } = await import("@/lib/league.server");
        const { fetchGameLog, pool } = await import("@/lib/nhl.server");
        const { computeSeason } = await import("@/lib/season");
        const sb = supabaseAdmin as any;
        const { season, draft, setup, ids } = await loadLeague(sb);

        let synced = 0;
        if (!totalsOnly) {
          const batch = ids.slice(offset, offset + limit);
          const logs = await pool(batch, 8, (id) => fetchGameLog(id));
          const rows = batch.flatMap((id, i) =>
            logs[i]!.map((g: any) => ({
              nhl_id: id,
              game_id: g.gameId,
              game_date: g.date,
              team: g.team,
              opp: g.opp,
              home: g.home,
              goals: g.g,
              assists: g.a,
            })),
          );
          for (let i = 0; i < rows.length; i += 500) {
            const { error } = await sb.from("player_games").upsert(rows.slice(i, i + 500));
            if (error) return Response.json({ error: error.message }, { status: 500 });
          }
          synced = batch.length;
        }

        const logs = await loadLogs(sb, ids);
        const data = computeSeason(draft, setup, { fetchedAt: "", logs, leaders: [], teamGP: {}, schedule: [] });
        const totals = data.history.dates.flatMap((d, di) => {
          const pts = draft.teams.map((t) => data.history.totals[t.slot]![di]!);
          const sorted = [...pts].sort((a, b) => b - a);
          return draft.teams.map((t, i) => ({
            season_id: season.id,
            total_date: d,
            slot: t.slot,
            points: pts[i],
            rank: sorted.indexOf(pts[i]!) + 1,
          }));
        });
        await sb.from("daily_totals").delete().eq("season_id", season.id);
        for (let i = 0; i < totals.length; i += 1000) {
          const { error } = await sb.from("daily_totals").insert(totals.slice(i, i + 1000));
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }
        await sb.from("seasons").update({ last_synced_at: new Date().toISOString() }).eq("id", season.id);
        return Response.json({ ok: true, players: ids.length, synced, dates: data.history.dates.length, lastDate: data.lastDate });
      },
    },
  },
});
