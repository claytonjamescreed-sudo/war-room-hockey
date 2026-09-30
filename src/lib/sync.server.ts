// Syncing NHL.com game logs into player_games and rebuilding daily_totals. Used by the cron
// route and by the commissioner's "Sync now" and swap tools. Service-role writes: callers must
// have checked the cron secret or the commissioner role first.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { GameLine } from "./season";

type Admin = SupabaseClient<Database>;

export async function adminClient(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

// Pull these players' game logs from NHL.com and upsert them
export async function syncGameLogs(sb: Admin, ids: number[]) {
  const { fetchGameLog, pool } = await import("./nhl.server");
  const logs = await pool(ids, 8, (id) => fetchGameLog(id));
  const rows = ids.flatMap((id, i) =>
    logs[i]!.map((g: GameLine) => ({
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
    if (error) throw new Error(error.message);
  }
  return ids.length;
}

// Recompute every team's total for every game day since count_from and replace daily_totals,
// then save each team's roster to roster_archive for the lockers
export async function rebuildDailyTotals(sb: Admin) {
  const { loadLeague, loadLogs } = await import("./league.server");
  const { computeSeason } = await import("./season");
  const { archiveRows } = await import("./archive");
  const { season, draft, setup, ids } = await loadLeague(sb);
  const logs = await loadLogs(sb, ids);
  const data = computeSeason(draft, setup, {
    fetchedAt: "",
    logs,
    leaders: [],
    teamGP: {},
    schedule: [],
  });
  const totals = data.history.dates.flatMap((d, di) => {
    const pts = draft.teams.map((t) => data.history.totals[t.slot]![di]!);
    const sorted = [...pts].sort((a, b) => b - a);
    return draft.teams.map((t, i) => ({
      season_id: season.id,
      total_date: d,
      slot: t.slot,
      points: pts[i]!,
      rank: sorted.indexOf(pts[i]!) + 1,
    }));
  });
  const del = await sb.from("daily_totals").delete().eq("season_id", season.id);
  if (del.error) throw new Error(del.error.message);
  for (let i = 0; i < totals.length; i += 1000) {
    const { error } = await sb.from("daily_totals").insert(totals.slice(i, i + 1000));
    if (error) throw new Error(error.message);
  }
  const rosters = archiveRows(season.id, data, draft, setup.moves).map((r) => ({
    ...r,
    updated_at: new Date().toISOString(),
  }));
  if (rosters.length) {
    const up = await sb.from("roster_archive").upsert(rosters);
    if (up.error) throw new Error(up.error.message);
    // A team taken out of the season takes its row with it
    const gone = await sb
      .from("roster_archive")
      .delete()
      .eq("season_id", season.id)
      .not("slot", "in", `(${rosters.map((r) => r.slot).join(",")})`);
    if (gone.error) throw new Error(gone.error.message);
  }
  await sb.from("seasons").update({ last_synced_at: new Date().toISOString() }).eq("id", season.id);
  return {
    seasonId: season.id,
    players: ids.length,
    dates: data.history.dates.length,
    lastDate: data.lastDate,
  };
}
