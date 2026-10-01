// Live points during games, from NHL.com's score feed. Pure, no I/O.
//
// A team's live total is its players' synced points from before tonight, plus any points from an
// earlier game day the morning sync hasn't picked up yet (matched by NHL game id, so nothing
// counts twice), plus tonight's points from the feed. Shootout goals don't count, as in NHL stats.

import type { Draft, GameLine, PlayerLine, SeasonTeam, Setup } from "./season";

export type FeedGoal = {
  period?: number;
  periodDescriptor?: { number?: number; periodType?: string };
  timeInPeriod?: string;
  playerId?: number;
  name?: { default?: string };
  teamAbbrev?: string;
  awayScore?: number;
  homeScore?: number;
  assists?: { playerId?: number; name?: { default?: string } }[];
};
export type FeedGame = {
  id: number;
  gameDate?: string;
  gameState?: string;
  startTimeUTC?: string;
  period?: number;
  periodDescriptor?: { number?: number; periodType?: string };
  clock?: { timeRemaining?: string; inIntermission?: boolean; running?: boolean };
  awayTeam?: { abbrev?: string; score?: number };
  homeTeam?: { abbrev?: string; score?: number };
  goals?: FeedGoal[];
};
export type FeedDay = { date: string; games: FeedGame[] };

export type PlayerStatus = "none" | "upcoming" | "live" | "done";
export type LiveGame = {
  id: number;
  state: string;
  status: PlayerStatus;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  label: string;
  start: string | null;
};
export type TickerPerson = { id: number; name: string; slot: number | null; owner: string | null };
export type TickerEntry = {
  key: string;
  gameId: number;
  label: string;
  score: string;
  team: string;
  scorer: TickerPerson;
  assists: TickerPerson[];
  // Each pool team credited on this goal, with its live total right after it
  credits: { slot: number; name: string; pts: number; total: number }[];
};
export type LiveTeam = {
  slot: number;
  name: string;
  base: number;
  tonight: number;
  total: number;
  rank: number;
  startRank: number;
  toPlay: number;
  playing: number;
  done: number;
};
export type LiveData = {
  date: string | null;
  anyLive: boolean;
  anyGames: boolean;
  games: LiveGame[];
  teams: LiveTeam[];
  ticker: TickerEntry[];
  // Each pool player: tonight's status and points, and his season before tonight (synced games
  // plus any earlier game the morning sync hasn't stored yet), so before + tonight is his live total
  players: Record<
    number,
    { status: PlayerStatus; g: number; a: number; before: { g: number; a: number } }
  >;
};

const STATUS: Record<string, PlayerStatus> = {
  FUT: "upcoming",
  PRE: "upcoming",
  LIVE: "live",
  CRIT: "live",
  FINAL: "done",
  OFF: "done",
};
export const gameStatus = (state: string | undefined): PlayerStatus =>
  STATUS[state ?? ""] ?? "upcoming";

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
const periodName = (pd: FeedGame["periodDescriptor"], period?: number) => {
  const type = pd?.periodType;
  if (type === "OT") return (pd?.number ?? 4) > 4 ? `${(pd?.number ?? 4) - 3}OT` : "OT";
  if (type === "SO") return "SO";
  return ordinal(pd?.number ?? period ?? 1);
};

// The hockey day, in Pacific time (the pool's home time zone). It turns over at 3 AM, when every
// game is long over, rather than around noon Eastern when NHL.com's "now" feed moves on to the
// next day. So from first thing in the morning, Tonight is the games coming up and last night is
// in the recap.
const PT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const hockeyDay = (now: Date) => PT_DAY.format(new Date(now.getTime() - 3 * 3_600_000));

// Start times in Pacific time too
const PT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});
export function gameLabel(g: FeedGame): string {
  const s = gameStatus(g.gameState);
  if (s === "done") {
    const t = g.periodDescriptor?.periodType;
    return t === "OT" || t === "SO" ? `Final/${t}` : "Final";
  }
  if (s === "live") {
    if (g.clock?.inIntermission) return `End of ${periodName(g.periodDescriptor, g.period)}`;
    const p = periodName(g.periodDescriptor, g.period);
    return p === "SO" ? "Shootout" : `${p} ${g.clock?.timeRemaining ?? ""}`.trim();
  }
  return g.startTimeUTC ? `${PT.format(new Date(g.startTimeUTC))} PT` : "Tonight";
}

const counts = (goal: FeedGoal) => goal.periodDescriptor?.periodType !== "SO";

// Seconds of game time elapsed at this goal, to order goals across games
const goalSeconds = (goal: FeedGoal) => {
  const [m, s] = (goal.timeInPeriod ?? "0:00").split(":").map(Number);
  const period = goal.periodDescriptor?.number ?? goal.period ?? 1;
  return (period - 1) * 20 * 60 + (m || 0) * 60 + (s || 0);
};

// Who owns whom on a date, applying swaps dated on or before it (same rule as season.ts)
export function rosterOn(draft: Draft, setup: Setup, date: string) {
  const out = new Map<number, number[]>();
  for (const t of draft.teams)
    out.set(
      t.slot,
      draft.picks.filter((p) => p.slot === t.slot).map((p) => p.id),
    );
  for (const m of [...setup.moves].sort((a, b) => a.date.localeCompare(b.date))) {
    if (m.date > date) continue;
    const ids = out.get(m.slot);
    const i = ids ? ids.indexOf(m.out) : -1;
    if (ids && i >= 0) ids[i] = m.in;
  }
  return out;
}

const rankAll = (totals: number[]) => {
  const sorted = [...totals].sort((a, b) => b - a);
  return totals.map((t) => sorted.indexOf(t) + 1);
};

// Points per player per game from a day's feed (shootout goals excluded)
function feedPoints(day: FeedDay) {
  const pts = new Map<string, { id: number; gameId: number; g: number; a: number }>();
  const add = (id: number | undefined, gameId: number, k: "g" | "a") => {
    if (!id) return;
    const key = `${id}:${gameId}`;
    const e = pts.get(key) ?? { id, gameId, g: 0, a: 0 };
    e[k]++;
    pts.set(key, e);
  };
  for (const game of day.games)
    for (const goal of game.goals ?? []) {
      if (!counts(goal)) continue;
      add(goal.playerId, game.id, "g");
      for (const a of goal.assists ?? []) add(a.playerId, game.id, "a");
    }
  return [...pts.values()];
}

export function computeLive(input: {
  date: string | null;
  feeds: FeedDay[];
  draft: Draft;
  setup: Setup;
  logs: Record<number, GameLine[]>;
}): LiveData {
  const { date, draft, setup, logs } = input;
  const empty: LiveData = {
    date,
    anyLive: false,
    anyGames: false,
    games: [],
    teams: [],
    ticker: [],
    players: {},
  };
  if (!date) return empty;
  const countFrom = setup.rules.countFrom;
  const tonight = input.feeds.find((f) => f.date === date) ?? { date, games: [] };
  const earlier = input.feeds.filter((f) => f.date < date && f.date >= countFrom);

  const roster = rosterOn(draft, setup, date);
  const ownerOf = new Map<number, number>();
  for (const [slot, ids] of roster) for (const id of ids) ownerOf.set(id, slot);
  const teamName = new Map(draft.teams.map((t) => [t.slot, t.name]));
  const poolName = new Map<number, string>();
  for (const p of draft.picks) poolName.set(p.id, p.name);
  for (const m of setup.moves) if (m.inName) poolName.set(m.in, m.inName);

  // Synced points before tonight, plus earlier days' feed points the sync hasn't stored yet
  const synced = new Set<string>();
  const before = (id: number) =>
    (logs[id] ?? []).reduce(
      (s, g) => {
        synced.add(`${id}:${g.gameId}`);
        return g.date >= countFrom && g.date < date ? { g: s.g + g.g, a: s.a + g.a } : s;
      },
      { g: 0, a: 0 },
    );
  const beforeById = new Map<number, { g: number; a: number }>();
  for (const id of ownerOf.keys()) beforeById.set(id, before(id));
  for (const day of earlier)
    for (const e of feedPoints(day)) {
      const b = beforeById.get(e.id);
      if (b && !synced.has(`${e.id}:${e.gameId}`)) {
        b.g += e.g;
        b.a += e.a;
      }
    }
  const baseById = new Map([...beforeById].map(([id, b]) => [id, b.g + b.a]));

  // Tonight, player by player
  const players: LiveData["players"] = {};
  const stateByTeam = new Map<string, PlayerStatus>();
  for (const g of tonight.games) {
    const s = gameStatus(g.gameState);
    if (g.awayTeam?.abbrev) stateByTeam.set(g.awayTeam.abbrev, s);
    if (g.homeTeam?.abbrev) stateByTeam.set(g.homeTeam.abbrev, s);
  }
  const lastTeam = (id: number) => {
    const gl = logs[id] ?? [];
    return gl.length
      ? [...gl].sort((a, b) => a.date.localeCompare(b.date))[gl.length - 1]!.team
      : null;
  };
  const pickTeam = new Map(draft.picks.map((p) => [p.id, p.team]));
  for (const id of ownerOf.keys()) {
    const team = lastTeam(id) ?? pickTeam.get(id) ?? null;
    players[id] = {
      status: (team && stateByTeam.get(team)) || "none",
      g: 0,
      a: 0,
      before: beforeById.get(id)!,
    };
  }
  for (const e of feedPoints(tonight)) {
    const p = players[e.id];
    if (!p) continue;
    p.g += e.g;
    p.a += e.a;
    // A player seen in tonight's feed is in that game whatever his team was in the logs
    if (p.status === "none") {
      const game = tonight.games.find((g) => g.id === e.gameId);
      p.status = gameStatus(game?.gameState);
    }
  }

  const slots = draft.teams.map((t) => t.slot);
  const baseOf = (slot: number) =>
    (roster.get(slot) ?? []).reduce((s, id) => s + (baseById.get(id) ?? 0), 0);
  const tonightOf = (slot: number) =>
    (roster.get(slot) ?? []).reduce(
      (s, id) => s + (players[id]?.g ?? 0) + (players[id]?.a ?? 0),
      0,
    );
  const bases = slots.map(baseOf);
  const nights = slots.map(tonightOf);
  const totals = slots.map((_, i) => bases[i]! + nights[i]!);
  const ranks = rankAll(totals);
  const startRanks = rankAll(bases);
  const teams: LiveTeam[] = slots
    .map((slot, i) => {
      const ids = roster.get(slot) ?? [];
      const st = (s: PlayerStatus) => ids.filter((id) => players[id]?.status === s).length;
      return {
        slot,
        name: teamName.get(slot) ?? `Team ${slot}`,
        base: bases[i]!,
        tonight: nights[i]!,
        total: totals[i]!,
        rank: ranks[i]!,
        startRank: startRanks[i]!,
        toPlay: st("upcoming"),
        playing: st("live"),
        done: st("done"),
      };
    })
    .sort((a, b) => a.rank - b.rank || b.tonight - a.tonight || a.name.localeCompare(b.name));

  // Goal ticker: every goal with a pool player in it, newest first, with running team totals
  const person = (id: number | undefined, feedName: string | undefined): TickerPerson => {
    const slot = id != null ? (ownerOf.get(id) ?? null) : null;
    return {
      id: id ?? 0,
      name: (id != null && poolName.get(id)) || feedName || "Unknown",
      slot,
      owner: slot != null ? (teamName.get(slot) ?? null) : null,
    };
  };
  const events = tonight.games.flatMap((game) => {
    const start = game.startTimeUTC ? Date.parse(game.startTimeUTC) : 0;
    const away = game.awayTeam?.abbrev ?? "";
    const home = game.homeTeam?.abbrev ?? "";
    return (game.goals ?? []).filter(counts).map((goal) => ({
      game,
      goal,
      order: start / 1000 + goalSeconds(goal) * 2.5,
      score: `${away} ${goal.awayScore ?? 0}–${goal.homeScore ?? 0} ${home}`,
    }));
  });
  events.sort((a, b) => a.order - b.order);
  const running = new Map<number, number>(slots.map((s, i) => [s, bases[i]!]));
  const ticker: TickerEntry[] = [];
  for (const { game, goal, score } of events) {
    const scorer = person(goal.playerId, goal.name?.default);
    const assists = (goal.assists ?? []).map((a) => person(a.playerId, a.name?.default));
    const involved = [scorer, ...assists].filter((p) => p.slot != null);
    if (!involved.length) continue;
    const bySlot = new Map<number, number>();
    for (const p of involved) bySlot.set(p.slot!, (bySlot.get(p.slot!) ?? 0) + 1);
    const credits = [...bySlot].map(([slot, pts]) => {
      running.set(slot, (running.get(slot) ?? 0) + pts);
      return { slot, name: teamName.get(slot) ?? `Team ${slot}`, pts, total: running.get(slot)! };
    });
    ticker.push({
      key: `${game.id}-${goal.periodDescriptor?.number ?? goal.period}-${goal.timeInPeriod}-${goal.playerId}`,
      gameId: game.id,
      label: `${periodName(goal.periodDescriptor, goal.period)} ${goal.timeInPeriod ?? ""}`.trim(),
      score,
      team: goal.teamAbbrev ?? "",
      scorer,
      assists,
      credits,
    });
  }
  ticker.reverse();

  const games: LiveGame[] = tonight.games
    .map((g) => ({
      id: g.id,
      state: g.gameState ?? "FUT",
      status: gameStatus(g.gameState),
      away: g.awayTeam?.abbrev ?? "",
      home: g.homeTeam?.abbrev ?? "",
      awayScore: gameStatus(g.gameState) === "upcoming" ? null : (g.awayTeam?.score ?? 0),
      homeScore: gameStatus(g.gameState) === "upcoming" ? null : (g.homeTeam?.score ?? 0),
      label: gameLabel(g),
      start: g.startTimeUTC ?? null,
    }))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.id - b.id);

  return {
    date,
    anyLive: games.some((g) => g.status === "live" || g.state === "PRE"),
    anyGames: games.length > 0,
    games,
    teams,
    ticker,
    players,
  };
}

// A player's season with tonight added: games, goals, assists and points as they stand right now
export function livePlayer(p: PlayerLine, live: LiveData) {
  const lp = live.players[p.id];
  if (!lp) return { gp: p.gp, g: p.g, a: p.a, pts: p.pts, tonight: null };
  const g = lp.before.g + lp.g;
  const a = lp.before.a + lp.a;
  // Tonight's game counts as played once it starts, unless the sync already stored it
  const synced = !!(p.lastGame && live.date && p.lastGame.date >= live.date);
  const playing = lp.status === "live" || lp.status === "done";
  return { gp: p.gp + (playing && !synced ? 1 : 0), g, a, pts: g + a, tonight: lp };
}

// A team's players in the order it drafted them, each with tonight added to his season
export function rosterRows(team: SeasonTeam, live: LiveData) {
  const order = new Map(team.drafted.map((d, i) => [d.id, i]));
  const round = new Map(team.drafted.map((d) => [d.id, d.round]));
  return team.roster
    .map((p) => {
      const l = livePlayer(p, live);
      return {
        p,
        l,
        round: round.get(p.id) ?? null,
        // A game that has started tonight counts as played, so it's no longer one of his left
        left: p.left - (l.gp - p.gp),
      };
    })
    .sort((x, y) => (order.get(x.p.id) ?? 99) - (order.get(y.p.id) ?? 99));
}
