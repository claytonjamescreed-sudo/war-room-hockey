// The pool's history, worked out from src/data/history.ts: pools in order, champions, records
// and each team's locker. Pure functions, tested in history.test.ts.
import { FINISHES, SHORT_SEASON, STORIES, type Finish, type PoolKind } from "../data/history";

export const KIND_NAME: Record<PoolKind, string> = { R: "Regular season", P: "Playoffs" };

export const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
};
export const place = (f: Finish) => (f.tie ? "T-" : "") + ord(f.r);
export const poolKey = (f: { k: PoolKind; s: string }) => `${f.k}|${f.s}`;
export const poolName = (f: { k: PoolKind; s: string }) => (f.k === "P" ? `${f.s} Playoffs` : f.s);

export type Pool = { key: string; k: PoolKind; s: string; rows: Finish[] };

// A regular season ends the spring its playoffs are played, so 2025-26 comes before the 2026
// playoffs. Newest first.
const when = (k: PoolKind, s: string) => Number(s.slice(0, 4)) + (k === "R" ? 1 : 0.5);

export function pools(finishes: Finish[] = FINISHES): Pool[] {
  const keys = [...new Set(finishes.map(poolKey))];
  return keys
    .map((key) => {
      const [k, s] = key.split("|") as [PoolKind, string];
      const rows = finishes
        .filter((f) => poolKey(f) === key)
        .sort((a, b) => a.r - b.r || b.p - a.p);
      return { key, k, s, rows };
    })
    .sort((a, b) => when(b.k, b.s) - when(a.k, a.s));
}

// How far ahead the champion finished
export const margin = (p: Pool) => (p.rows[0]?.p ?? 0) - (p.rows[1]?.p ?? 0);

export function records(finishes: Finish[] = FINISHES) {
  const reg = finishes.filter((f) => f.k === "R" && f.s !== SHORT_SEASON);
  const po = finishes.filter((f) => f.k === "P");
  const most = (list: Finish[]) => {
    const count = new Map<string, number>();
    for (const f of list) count.set(f.t, (count.get(f.t) ?? 0) + 1);
    const max = Math.max(...count.values());
    return { n: max, who: [...count].filter(([, c]) => c === max).map(([t]) => t) };
  };
  const top = (list: Finish[]) => list.reduce((a, b) => (b.p > a.p ? b : a));
  return {
    titles: most(finishes.filter((f) => f.r === 1)),
    podiums: most(finishes.filter((f) => f.r <= 3)),
    bestSeason: top(reg),
    bestPlayoff: top(po),
    poolCount: new Set(finishes.map(poolKey)).size,
  };
}

// Teams with the most pools entered first
export function teamNames(finishes: Finish[] = FINISHES) {
  const count = new Map<string, number>();
  for (const f of finishes) count.set(f.t, (count.get(f.t) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

// The Team Lockers list: this season's teams (new ones included), then the teams no longer in the
// pool, whose lockers stay open. Both A to Z.
export function lockerGroups(currentNames: string[], finishes: Finish[] = FINISHES) {
  const az = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  const now = new Set(currentNames.map((n) => historyName(n, finishes)));
  return {
    current: [...now].sort(az),
    former: teamNames(finishes)
      .filter((t) => !now.has(t))
      .sort(az),
  };
}

const avg = (a: number[]) =>
  a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

export function locker(team: string, finishes: Finish[] = FINISHES) {
  const order = pools(finishes).map((p) => p.key);
  const rows = finishes
    .filter((f) => f.t === team)
    .sort((a, b) => order.indexOf(poolKey(a)) - order.indexOf(poolKey(b)));
  if (!rows.length) return null;
  const reg = rows.filter((f) => f.k === "R");
  const regFull = reg.filter((f) => f.s !== SHORT_SEASON);
  const po = rows.filter((f) => f.k === "P");
  const best = rows.reduce((a, b) => (b.r < a.r || (b.r === a.r && b.p / b.n > a.p / a.n) ? b : a));
  const top = (list: Finish[]) => (list.length ? list.reduce((a, b) => (b.p > a.p ? b : a)) : null);
  const winner = (f: Finish) => finishes.find((x) => poolKey(x) === poolKey(f) && x.r === 1)!;
  return {
    team,
    rows, // newest first
    aka: [...new Set(rows.map((f) => f.raw).filter((n) => n !== team))],
    titles: rows.filter((f) => f.r === 1),
    medals: [...rows.filter((f) => f.r === 2), ...rows.filter((f) => f.r === 3)],
    podiums: rows.filter((f) => f.r <= 3).length,
    best,
    bestSeason: top(regFull),
    avgSeason: avg(regFull.map((f) => f.p)),
    fullSeasons: regFull.length,
    playedShort: reg.some((f) => f.s === SHORT_SEASON),
    bestPlayoff: top(po),
    avgPlayoff: avg(po.map((f) => f.p)),
    playoffPools: po.length,
    avgFinish: Math.round(rows.reduce((s, f) => s + f.r, 0) / rows.length),
    gapToFirst: (f: Finish) => (f.r === 1 ? null : winner(f).p - f.p),
    story: STORIES[team] ?? null,
  };
}

// The locker a pool team's name belongs to, old spellings included ("TW3" is The Wheeler). A team
// new to the pool gets a locker under its own name.
export function historyName(name: string, finishes: Finish[] = FINISHES) {
  const key = name.trim().toLowerCase();
  const f =
    finishes.find((x) => x.t.toLowerCase() === key) ??
    finishes.find((x) => x.raw.toLowerCase() === key);
  return f?.t ?? name.trim();
}

// Search params that open a team's locker
export const lockerSearch = (name: string) => ({ view: "teams" as const, team: historyName(name) });

// A line for a team with no written scouting report
export function hypeLine(l: NonNullable<ReturnType<typeof locker>>) {
  const titles = l.titles.length;
  if (titles >= 2) return `${titles}-time champion. Everyone else is drafting to catch ${l.team}.`;
  if (titles === 1)
    return `A banner already hangs for ${l.team}. The question is whether it gets company.`;
  if (l.podiums > 0)
    return `${l.podiums} podium finish${l.podiums > 1 ? "es" : ""} and no banner yet. Close enough to taste it.`;
  const best = Math.min(...l.rows.map((f) => f.r));
  if (best <= 6) return `Best finish so far: ${ord(best)}. The podium is right there.`;
  return "Still hunting that first podium. Every dynasty starts with a draft.";
}
