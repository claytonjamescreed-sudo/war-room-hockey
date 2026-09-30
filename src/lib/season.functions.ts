import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

let memo: { at: number; data: unknown } | null = null;

export const getSeason = createServerFn({ method: "GET" }).handler(async () => {
  if (memo && Date.now() - memo.at < 60_000) return memo.data as Awaited<ReturnType<typeof build>>;
  const data = await build();
  memo = { at: Date.now(), data };
  return data;
});

async function build() {
  const { publicClient, loadLeague, loadLogs } = await import("./league.server");
  const { fetchLeaders, fetchTeamGP, fetchSchedule } = await import("./nhl.server");
  const { computeSeason } = await import("./season");
  const sb = publicClient();
  const { season, draft, setup, ids } = await loadLeague(sb);
  const [logs, leaders, teamGP, schedule] = await Promise.all([
    loadLogs(sb, ids),
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
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchScores } = await import("./nhl.server");
    return (await fetchScores(data.date)) as Record<string, unknown> | null;
  });

export const getBoxscore = createServerFn({ method: "GET" })
  .inputValidator((d: { gameId: number }) => z.object({ gameId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { fetchBoxscore } = await import("./nhl.server");
    return (await fetchBoxscore(data.gameId)) as Record<string, unknown> | null;
  });
