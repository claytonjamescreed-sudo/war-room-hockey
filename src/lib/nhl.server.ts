// NHL.com relay: plain User-Agent, short in-memory caching, retries like season.js.
const UA = "war-room-hockey-pool/1.0";
const cache = new Map<string, { at: number; data: unknown }>();

export async function nhlJSON<T = any>(url: string, ttlMs: number, retries = 2): Promise<T | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, redirect: "follow" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as T;
      cache.set(url, { at: Date.now(), data });
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
      return data;
    } catch (err) {
      if (attempt >= retries) {
        console.error("NHL fetch failed", url, err);
        if (hit) return hit.data as T; // stale is better than nothing
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

export const NHL_SEASON = "20262027";
export const TTL = { live: 30_000, logs: 5 * 60_000, standings: 10 * 60_000 };

export async function fetchGameLog(id: number) {
  const j = await nhlJSON<any>(`https://api-web.nhle.com/v1/player/${id}/game-log/${NHL_SEASON}/2`, TTL.logs);
  return (j?.gameLog || []).map((g: any) => ({
    date: g.gameDate as string,
    gameId: g.gameId as number,
    team: g.teamAbbrev as string,
    opp: g.opponentAbbrev as string,
    home: g.homeRoadFlag === "H",
    g: (g.goals || 0) as number,
    a: (g.assists || 0) as number,
  }));
}

export async function fetchLeaders(limit = 300) {
  const url =
    `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&start=0&limit=${limit}` +
    "&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D%5D" +
    `&cayenneExp=seasonId=${NHL_SEASON}%20and%20gameTypeId=2`;
  const j = await nhlJSON<any>(url, TTL.standings);
  return (j?.data || []).map((r: any) => ({
    id: r.playerId as number,
    name: r.skaterFullName as string,
    team: String(r.teamAbbrevs || "").split(",").pop() as string,
    pos: r.positionCode as string,
    gp: r.gamesPlayed as number,
    g: r.goals as number,
    a: r.assists as number,
    pts: r.points as number,
  }));
}

export async function fetchTeamGP(): Promise<Record<string, number>> {
  const j = await nhlJSON<any>("https://api-web.nhle.com/v1/standings/now", TTL.standings);
  return Object.fromEntries((j?.standings || []).map((t: any) => [t.teamAbbrev?.default, t.gamesPlayed]));
}

export async function fetchSchedule() {
  const j = await nhlJSON<any>("https://api-web.nhle.com/v1/schedule/now", TTL.standings);
  return (j?.gameWeek || []).map((d: any) => ({
    date: d.date as string,
    games: (d.games || []).map((g: any) => ({
      state: g.gameState as string,
      away: g.awayTeam?.abbrev as string,
      home: g.homeTeam?.abbrev as string,
      start: g.startTimeUTC as string,
    })),
  }));
}

export async function fetchScores(date?: string) {
  return nhlJSON<any>(`https://api-web.nhle.com/v1/score/${date ?? "now"}`, TTL.live);
}

export async function fetchBoxscore(gameId: number) {
  return nhlJSON<any>(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`, TTL.live);
}

export async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}
