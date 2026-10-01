// Man games for each pool team, from the synced game logs. Pure, tested in man-games.test.ts.
//
// Played: games its players played while on its roster. Missed: games their NHL teams played in
// that time that they didn't dress for (injuries, scratches, rest). A swapped player counts only
// for the days he was on the team: the dropped player up to the swap date, the new one from it.
//
// An NHL team's games come from the logs themselves: every line names the player's team and the
// opponent that night, so a game is known for both teams as soon as any logged player dressed for
// either. That gives games by date (the standings only give a total), which a swap needs, and it
// follows a traded player, whose lines carry the team he played for each night.
import type { Draft, GameLine, Setup } from "./season";

export type ManGames = { played: number; missed: number };

// Points per game the way hockey shows it, "1.25"; a dash before the first game
export const perGame = (points: number, games: number) =>
  games > 0 ? (points / games).toFixed(2) : "–";

// On the roster from `from`, up to but not including `to`
type Stint = { id: number; from: string; to: string | null };

// Each pool team's players with the dates they were on it, following rosterAt() in season.ts
export function rosterStints(draft: Draft, setup: Setup): Map<number, Stint[]> {
  const moves = [...(setup.moves || [])].sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<number, Stint[]>();
  for (const t of draft.teams) {
    const stints: Stint[] = draft.picks
      .filter((p) => p.slot === t.slot)
      .map((p) => ({ id: p.id, from: setup.rules.countFrom, to: null }));
    for (const m of moves) {
      if (m.slot !== t.slot) continue;
      const leaving = stints.find((s) => s.id === m.out && s.to == null);
      if (!leaving) continue;
      leaving.to = m.date;
      stints.push({ id: m.in, from: m.date, to: null });
    }
    out.set(t.slot, stints);
  }
  return out;
}

// Counts one player's games between two dates: `count(id, from, to)` is his games played and his
// NHL team's games he didn't dress for, from `from` up to but not including `to`
function counter(
  setup: Setup,
  logs: Record<number, GameLine[]>,
  knownTeam: Map<number, string | null>,
) {
  const { countFrom } = setup.rules;
  const lineCache = new Map<number, GameLine[]>();
  const lines = (id: number) => {
    let l = lineCache.get(id);
    if (!l) {
      l = (logs[id] ?? [])
        .filter((x) => x.date >= countFrom)
        .sort((a, b) => a.date.localeCompare(b.date));
      lineCache.set(id, l);
    }
    return l;
  };

  // NHL team -> game id -> date
  const teamGames = new Map<string, Map<number, string>>();
  const see = (team: string | null | undefined, gameId: number, date: string) => {
    if (!team) return;
    let games = teamGames.get(team);
    if (!games) teamGames.set(team, (games = new Map()));
    games.set(gameId, date);
  };
  for (const id of Object.keys(logs))
    for (const x of lines(Number(id))) {
      see(x.team, x.gameId, x.date);
      see(x.opp, x.gameId, x.date);
    }

  return (id: number, from: string, to: string | null): ManGames => {
    const mine = lines(id);
    const inRange = (date: string) => date >= from && (to == null || date < to);
    const played = mine.filter((x) => inRange(x.date)).length;

    // His NHL team on a date: the team of his last game up to then, else of his first game
    // after it, else the team we know him by
    const teamOn = (date: string) => {
      let team: string | null = null;
      for (const x of mine) {
        if (x.date > date) {
          team ??= x.team;
          break;
        }
        team = x.team;
      }
      return team ?? knownTeam.get(id) ?? null;
    };
    const dressed = new Set(mine.map((x) => x.gameId));
    const hisTeams = new Set([...mine.map((x) => x.team), knownTeam.get(id)]);
    let missed = 0;
    for (const team of hisTeams) {
      if (!team) continue;
      for (const [gameId, date] of teamGames.get(team) ?? [])
        if (inRange(date) && !dressed.has(gameId) && teamOn(date) === team) missed++;
    }
    return { played, missed };
  };
}

// A player's NHL team when he has no games to tell us (out since the start of the season)
const draftTeams = (draft: Draft) => new Map(draft.picks.map((p) => [p.id, p.team]));

// Each pool team's totals, counting every player only while he was on its roster
export function manGames(
  draft: Draft,
  setup: Setup,
  logs: Record<number, GameLine[]>,
  knownTeam: Map<number, string | null> = draftTeams(draft),
): Map<number, ManGames> {
  const count = counter(setup, logs, knownTeam);
  const out = new Map<number, ManGames>();
  for (const [slot, stints] of rosterStints(draft, setup)) {
    const total = { played: 0, missed: 0 };
    for (const s of stints) {
      const c = count(s.id, s.from, s.to);
      total.played += c.played;
      total.missed += c.missed;
    }
    out.set(slot, total);
  }
  return out;
}

// One player's whole counted season, for his row in a roster: like his goals and points there,
// it isn't cut off at a swap (a swapped-in player counts for his whole season)
export function playerManGames(
  draft: Draft,
  setup: Setup,
  logs: Record<number, GameLine[]>,
  knownTeam: Map<number, string | null> = draftTeams(draft),
): (id: number) => ManGames {
  const count = counter(setup, logs, knownTeam);
  return (id) => count(id, setup.rules.countFrom, null);
}
