// Faithful TypeScript port of computeSeason() from season.js. Pure, no I/O.
// Do not change behaviour: tests in season.test.ts pin it.
// Added on top of the port, changing none of its points or ranks: each player's games missed,
// games left and next game, each team's man games (played and missed from man-games.ts, and games
// left), and who's hurt (injuries.ts).
// The projection is the one number that differs from season.js: the rate is per game the player
// has played (season.js divided by his team's games, so a game he sat out pulled his rate down),
// and the games he's expected to miss while hurt aren't counted among the games to come.

import { gamesOut, matchInjuries, type Injury, type ReportLine } from "./injuries";
import { manGames, playerManGames } from "./man-games";

export const PRIOR_GAMES = 20;
export const DEFAULT_RATE = 0.45;

export type DraftTeam = { slot: number; name: string };
export type DraftPick = {
  pick: number;
  round: number;
  slot: number;
  id: number;
  name: string;
  team: string | null;
  pos: string | null;
  preseasonProj: number | null;
};
export type Draft = { season: string; teams: DraftTeam[]; picks: DraftPick[] };
export type Move = { date: string; slot: number; out: number; in: number; inName?: string | null };
export type Rules = {
  countFrom: string;
  seasonGames: number;
  redraftSwaps: number;
  redraftNote?: string;
};
export type Setup = { rules: Rules; moves: Move[] };
export type GameLine = {
  date: string;
  gameId: number;
  team: string;
  opp: string;
  home: boolean;
  g: number;
  a: number;
};
export type Leader = {
  id: number;
  name: string;
  team: string;
  pos: string;
  gp: number;
  g: number;
  a: number;
  pts: number;
};
export type ScheduleDay = {
  date: string;
  games: { state: string; away: string; home: string; start: string }[];
};
export type Raw = {
  fetchedAt: string;
  logs: Record<string | number, GameLine[]>;
  leaders: Leader[];
  teamGP: Record<string, number>;
  schedule: ScheduleDay[];
  // ESPN's injury report and today's date (the hockey day), for who's hurt and the games he's
  // expected to miss. Without them nobody is hurt.
  injuries?: ReportLine[];
  today?: string;
};

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Info = { name: string; team: string | null; pos: string | null; proj: number | null };

export type PlayerLine = {
  id: number;
  name: string;
  team: string | null;
  pos: string | null;
  gp: number;
  g: number;
  a: number;
  pts: number;
  lastNight: { g: number; a: number; opp: string; home: boolean } | null;
  lastGame: { date: string; g: number; a: number; opp: string; home: boolean } | null;
  last7: number;
  playsNext: boolean;
  preseason: number | null;
  projected: number;
  // Games his NHL team has played that he didn't dress for, and games it has left
  missed: number;
  left: number;
  // His NHL team's next game in the week's schedule (tonight's, until it's over)
  nextGame: { date: string; opp: string; home: boolean; start: string } | null;
  // On ESPN's injury report (see injuries.ts), and how many of his team's games he's expected to
  // miss before he's back: they're left out of his projection
  injury?: Injury;
  expectedOut: number;
};

export function computeSeason(draft: Draft, setup: Setup, raw: Raw) {
  const { rules } = setup;
  const moves = [...(setup.moves || [])].sort((a, b) => a.date.localeCompare(b.date));
  const info = new Map<number, Info>();
  for (const p of draft.picks)
    info.set(p.id, { name: p.name, team: p.team, pos: p.pos, proj: p.preseasonProj });
  for (const l of raw.leaders)
    if (!info.has(l.id)) info.set(l.id, { name: l.name, team: l.team, pos: l.pos, proj: null });
  for (const m of moves)
    if (!info.has(m.in))
      info.set(m.in, { name: m.inName || `#${m.in}`, team: null, pos: null, proj: null });

  const gameCache = new Map<number, GameLine[]>();
  const games = (id: number) => {
    let g = gameCache.get(id);
    if (!g) {
      g = (raw.logs[id] || [])
        .filter((x) => x.date >= rules.countFrom)
        .sort((a, b) => a.date.localeCompare(b.date));
      gameCache.set(id, g);
    }
    return g;
  };
  const dates = [
    ...new Set(Object.keys(raw.logs).flatMap((id) => games(Number(id)).map((g) => g.date))),
  ].sort();
  const lastDate = dates[dates.length - 1] || null;
  const cumAt = (id: number, date: string) =>
    games(id).reduce((s, g) => (g.date <= date ? s + g.g + g.a : s), 0);

  const rosterAt = (slot: number, date: string | null) => {
    const ids = draft.picks.filter((p) => p.slot === slot).map((p) => p.id);
    for (const m of moves) {
      if (m.slot !== slot || (date && m.date > date)) continue;
      const i = ids.indexOf(m.out);
      if (i >= 0) ids[i] = m.in;
    }
    return ids;
  };
  const totalAt = (slot: number, date: string) =>
    rosterAt(slot, date).reduce((s, id) => s + cumAt(id, date), 0);

  const slots = draft.teams.map((t) => t.slot);
  const history = {
    dates,
    totals: Object.fromEntries(slots.map((s) => [s, dates.map((d) => totalAt(s, d))])) as Record<
      number,
      number[]
    >,
  };
  const rankOf = (totals: number[]) => {
    const sorted = [...totals].sort((a, b) => b - a);
    return totals.map((t) => sorted.indexOf(t) + 1);
  };
  const nowTotals = slots.map((s) => (lastDate ? totalAt(s, lastDate) : 0));
  const prevDate = dates.length > 1 ? dates[dates.length - 2] : null;
  const prevTotals = slots.map((s) => (prevDate ? totalAt(s, prevDate) : 0));
  const nowRank = rankOf(nowTotals);
  const prevRank = prevDate ? rankOf(prevTotals) : null;
  const leaderPts = Math.max(0, ...nowTotals);
  const weekStart = lastDate ? addDays(lastDate, -6) : null;

  const nextDay = raw.schedule.find((d) =>
    d.games.some((g) => g.state === "FUT" || g.state === "PRE" || g.state === "LIVE"),
  );
  const playingNext = new Set(nextDay ? nextDay.games.flatMap((g) => [g.away, g.home]) : []);
  // Each NHL team's next game that isn't over yet
  const nextGame = new Map<string, NonNullable<PlayerLine["nextGame"]>>();
  for (const d of raw.schedule)
    for (const g of d.games) {
      if (g.state !== "FUT" && g.state !== "PRE" && g.state !== "LIVE" && g.state !== "CRIT")
        continue;
      if (!nextGame.has(g.away))
        nextGame.set(g.away, { date: d.date, opp: g.home, home: false, start: g.start });
      if (!nextGame.has(g.home))
        nextGame.set(g.home, { date: d.date, opp: g.away, home: true, start: g.start });
    }

  // Games missed, by player and by team (see man-games.ts)
  const knownTeam = new Map([...info].map(([id, p]) => [id, p.team]));
  const playerMan = playerManGames(draft, setup, raw.logs, knownTeam);
  const man = manGames(draft, setup, raw.logs, knownTeam);

  // Who's hurt, among the players on a roster now
  const team0 = (id: number) => {
    const gl = games(id);
    return gl.length ? gl[gl.length - 1]!.team : (info.get(id)?.team ?? null);
  };
  const injuryOf = matchInjuries(
    slots.flatMap((s) =>
      rosterAt(s, null).map((id) => ({
        id,
        name: info.get(id)?.name ?? "",
        team: team0(id),
        pos: info.get(id)?.pos ?? null,
      })),
    ),
    raw.injuries ?? [],
  );
  const today = raw.today ?? lastDate ?? rules.countFrom;

  const playerLine = (id: number): PlayerLine => {
    const gl = games(id);
    const p = info.get(id) || ({} as Partial<Info>);
    const g = gl.reduce((s, x) => s + x.g, 0);
    const a = gl.reduce((s, x) => s + x.a, 0);
    const team = gl.length ? gl[gl.length - 1]!.team : (p.team ?? null);
    const last = gl.length ? gl[gl.length - 1]! : null;
    const teamGP = (team != null ? raw.teamGP[team] : undefined) ?? gl.length;
    const remaining = Math.max(0, rules.seasonGames - teamGP);
    const prior = p.proj != null ? p.proj / rules.seasonGames : DEFAULT_RATE;
    // Points a game he has played (a game he sat out isn't a game he was held off the sheet),
    // times the games he's expected to play: his team's games left, less those he'll miss hurt
    const rate = (prior * PRIOR_GAMES + g + a) / (PRIOR_GAMES + gl.length);
    const injury = injuryOf[id];
    const expectedOut = Math.min(remaining, gamesOut(injury, team, raw.schedule, today));
    return {
      id,
      name: p.name as string,
      team,
      pos: p.pos ?? null,
      gp: gl.length,
      g,
      a,
      pts: g + a,
      lastNight:
        last && last.date === lastDate
          ? { g: last.g, a: last.a, opp: last.opp, home: last.home }
          : null,
      lastGame: last
        ? { date: last.date, g: last.g, a: last.a, opp: last.opp, home: last.home }
        : null,
      last7: gl
        .filter((x) => weekStart != null && x.date >= weekStart)
        .reduce((s, x) => s + x.g + x.a, 0),
      playsNext: team != null && playingNext.has(team),
      preseason: p.proj ?? null,
      projected: Math.round(g + a + rate * (remaining - expectedOut)),
      expectedOut,
      ...(injury ? { injury } : {}),
      missed: playerMan(id).missed,
      left: remaining,
      nextGame: (team != null ? nextGame.get(team) : undefined) ?? null,
    };
  };

  const teams = draft.teams.map((t, i) => {
    const current = rosterAt(t.slot, null).map(playerLine);
    const dropped = moves
      .filter((m) => m.slot === t.slot)
      .map((m) => ({ ...playerLine(m.out), droppedOn: m.date, replacedBy: info.get(m.in)?.name }));
    const lastNight = current.reduce(
      (s, p) => s + (p.lastNight ? p.lastNight.g + p.lastNight.a : 0),
      0,
    );
    return {
      slot: t.slot,
      name: t.name,
      pts: nowTotals[i]!,
      rank: nowRank[i]!,
      prevRank: prevRank ? prevRank[i]! : null,
      back: leaderPts - nowTotals[i]!,
      lastNight,
      last7: current.reduce((s, p) => s + p.last7, 0),
      playingNext: current.filter((p) => p.playsNext).length,
      projected: current.reduce((s, p) => s + p.projected, 0),
      preseason: Math.round(
        draft.picks
          .filter((p) => p.slot === t.slot)
          .reduce((s, p) => s + (p.preseasonProj || 0), 0),
      ),
      manGames: {
        played: man.get(t.slot)?.played ?? 0,
        missed: man.get(t.slot)?.missed ?? 0,
        // NHL games its current players still have to play
        left: current.reduce((s, p) => s + p.left, 0),
      },
      swapsUsed: moves.filter((m) => m.slot === t.slot).length,
      roster: current.sort((a, b) => b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name)),
      dropped,
      // Draft order, with a swapped-in player in the place of the one he replaced (round null)
      drafted: rosterAt(t.slot, null).map((id) => ({
        id,
        round: draft.picks.find((p) => p.slot === t.slot && p.id === id)?.round ?? null,
      })),
    };
  });
  teams.sort(
    (a, b) => a.rank - b.rank || b.projected - a.projected || a.name.localeCompare(b.name),
  );

  const owner = new Map<number, string>();
  for (const t of teams) for (const p of t.roster) owner.set(p.id, t.name);
  const everyone = teams.flatMap((t) =>
    t.roster.map((p) => ({ ...p, owner: t.name, ownerSlot: t.slot })),
  );
  const lastNight = everyone
    .filter((p) => p.lastNight && p.lastNight.g + p.lastNight.a > 0)
    .sort(
      (a, b) =>
        b.lastNight!.g + b.lastNight!.a - (a.lastNight!.g + a.lastNight!.a) ||
        b.lastNight!.g - a.lastNight!.g,
    );
  const topPool = [...everyone]
    .sort((a, b) => b.pts - a.pts || b.g - a.g || a.gp - b.gp)
    .slice(0, 15);
  const available = raw.leaders.filter((l) => !owner.has(l.id)).slice(0, 15);

  return {
    season: draft.season,
    fetchedAt: raw.fetchedAt,
    countFrom: rules.countFrom,
    seasonGames: rules.seasonGames,
    redraftSwaps: rules.redraftSwaps,
    redraftNote: rules.redraftNote,
    lastDate,
    gameDays: dates.length,
    nextDay: nextDay ? { date: nextDay.date, games: nextDay.games.length } : null,
    teams,
    history,
    lastNight,
    topPool,
    available,
    moves: moves.map((m) => {
      const t = draft.teams.find((x) => x.slot === m.slot);
      return {
        date: m.date,
        team: t?.name,
        slot: m.slot,
        out: info.get(m.out)?.name,
        in: info.get(m.in)?.name,
      };
    }),
  };
}

export type SeasonData = ReturnType<typeof computeSeason>;
export type SeasonTeam = SeasonData["teams"][number];
