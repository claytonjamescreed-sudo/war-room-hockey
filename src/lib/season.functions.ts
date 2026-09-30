import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LiveData } from "./live";

let memo: { at: number; v: number; data: unknown } | null = null;

export const getSeason = createServerFn({ method: "GET" }).handler(async () => {
  const { cacheVersion } = await import("./league.server");
  const v = cacheVersion();
  if (memo && memo.v === v && Date.now() - memo.at < 60_000)
    return memo.data as Awaited<ReturnType<typeof build>>;
  const data = await build();
  memo = { at: Date.now(), v, data };
  return data;
});

async function build() {
  const { leagueWithLogs } = await import("./league.server");
  const { fetchLeaders, fetchTeamGP, fetchSchedule } = await import("./nhl.server");
  const { computeSeason } = await import("./season");
  const [{ season, draft, setup, logs }, leaders, teamGP, schedule] = await Promise.all([
    leagueWithLogs(),
    fetchLeaders(300).catch(() => []),
    fetchTeamGP().catch(() => ({})),
    fetchSchedule().catch(() => []),
  ]);
  const data = computeSeason(draft, setup, {
    fetchedAt: season.last_synced_at ?? new Date().toISOString(),
    logs,
    leaders,
    teamGP,
    schedule,
  });
  // Full best-available list (not just 15) for the redraft
  const owned = new Set(data.teams.flatMap((t) => t.roster.map((p) => p.id)));
  const availableAll = leaders.filter((l: { id: number }) => !owned.has(l.id)).slice(0, 100);
  return { ...data, availableAll, syncedAt: season.last_synced_at };
}

// NHL relay for the browser (NHL.com sends no CORS headers)
export const getScores = createServerFn({ method: "GET" })
  .inputValidator((d: { date?: string } | undefined) =>
    z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchScores } = await import("./nhl.server");
    return JSON.stringify(await fetchScores(data.date));
  });

export const getBoxscore = createServerFn({ method: "GET" })
  .inputValidator((d: { gameId: number }) =>
    z.object({ gameId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { fetchBoxscore } = await import("./nhl.server");
    return JSON.stringify(await fetchBoxscore(data.gameId));
  });

// Live points tonight: NHL.com's score feed on top of the synced standings. A feed failure
// returns an empty night rather than breaking the page.
let liveMemo: { at: number; v: number; data: Promise<LiveData> } | null = null;
export const getLive = createServerFn({ method: "GET" }).handler(async (): Promise<LiveData> => {
  const { cacheVersion } = await import("./league.server");
  const v = cacheVersion();
  if (liveMemo && liveMemo.v === v && Date.now() - liveMemo.at < 20_000) return liveMemo.data;
  const data = buildLive().catch((err): LiveData => {
    console.error("live tonight failed", err);
    return {
      date: null,
      anyLive: false,
      anyGames: false,
      games: [],
      teams: [],
      ticker: [],
      players: {},
    };
  });
  liveMemo = { at: Date.now(), v, data };
  return data;
});

async function buildLive(): Promise<LiveData> {
  const { leagueWithLogs } = await import("./league.server");
  const { fetchScores } = await import("./nhl.server");
  const { computeLive } = await import("./live");
  const [now, league] = await Promise.all([fetchScores(), leagueWithLogs()]);
  const date: string | null = now?.currentDate ?? null;
  const feeds = date ? [{ date, games: now.games ?? [] }] : [];
  // The day before, in case last night's games aren't in the morning sync yet
  if (now?.prevDate) {
    const prev = await fetchScores(now.prevDate).catch(() => null);
    if (prev) feeds.push({ date: now.prevDate, games: prev.games ?? [] });
  }
  return computeLive({ date, feeds, draft: league.draft, setup: league.setup, logs: league.logs });
}

// Past seasons' final pool rosters for the team lockers (the current season comes live from
// getSeason instead). Rows the daily sync saved in roster_archive; public data only.
export const getRosterArchive = createServerFn({ method: "GET" }).handler(async () => {
  const { publicClient } = await import("./league.server");
  const sb = publicClient();
  const [current, rows] = await Promise.all([
    sb.from("seasons").select("id").eq("is_current", true).maybeSingle(),
    sb
      .from("roster_archive")
      .select("season_id,slot,team_name,rank,points,players,dropped")
      .order("season_id", { ascending: false })
      .order("rank"),
  ]);
  if (rows.error) throw new Error(rows.error.message);
  const past = (rows.data ?? []).filter((r) => r.season_id !== current.data?.id);
  return JSON.stringify(past);
});
