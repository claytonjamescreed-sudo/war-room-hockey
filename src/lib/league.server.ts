// Reads the league from the database (public data only) and builds season.ts inputs.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Draft, GameLine, Setup } from "./season";

export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type Client = ReturnType<typeof publicClient>;

export async function loadLeague(sb: Client) {
  const { data: season, error } = await sb
    .from("seasons")
    .select("*")
    .eq("is_current", true)
    .single();
  if (error || !season) throw new Error("No current season");
  const [teams, picks, moves] = await Promise.all([
    sb.from("pool_teams").select("slot,name").eq("season_id", season.id).order("slot"),
    sb.from("draft_picks").select("*").eq("season_id", season.id).order("pick_no"),
    sb.from("roster_moves").select("*").eq("season_id", season.id).order("move_date"),
  ]);
  const draft: Draft = {
    season: season.id,
    teams: teams.data ?? [],
    picks: (picks.data ?? []).map((p) => ({
      pick: p.pick_no,
      round: p.round,
      slot: p.slot,
      id: p.nhl_id,
      name: p.name,
      team: p.team,
      pos: p.pos,
      preseasonProj: p.preseason_proj == null ? null : Number(p.preseason_proj),
    })),
  };
  const setup: Setup = {
    rules: {
      countFrom: season.count_from,
      seasonGames: season.season_games,
      redraftSwaps: season.swaps_per_team,
    },
    moves: (moves.data ?? []).map((m) => ({
      date: m.move_date,
      slot: m.slot,
      out: m.out_id,
      in: m.in_id,
      inName: m.in_name,
    })),
  };
  const ids = [
    ...new Set([...draft.picks.map((p) => p.id), ...setup.moves.flatMap((m) => [m.out, m.in])]),
  ];
  return { season, draft, setup, ids };
}

export async function loadLogs(sb: Client, ids: number[]) {
  const logs: Record<number, GameLine[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("player_games")
      .select("nhl_id,game_id,game_date,team,opp,home,goals,assists")
      .in("nhl_id", ids)
      .order("nhl_id")
      .order("game_id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const r of data ?? [])
      logs[r.nhl_id]?.push({
        date: r.game_date,
        gameId: Number(r.game_id),
        team: r.team ?? "",
        opp: r.opp ?? "",
        home: !!r.home,
        g: r.goals,
        a: r.assists,
      });
    if (!data || data.length < pageSize) break;
  }
  return logs;
}

// League and synced game logs, shared by the standings and live functions for a minute
let leagueMemo: {
  at: number;
  data: Promise<Awaited<ReturnType<typeof loadLeague>> & { logs: Record<number, GameLine[]> }>;
} | null = null;
export function leagueWithLogs() {
  if (leagueMemo && Date.now() - leagueMemo.at < 60_000) return leagueMemo.data;
  const data = (async () => {
    const sb = publicClient();
    const league = await loadLeague(sb);
    return { ...league, logs: await loadLogs(sb, league.ids) };
  })();
  leagueMemo = { at: Date.now(), data };
  data.catch(() => (leagueMemo = null));
  return data;
}
