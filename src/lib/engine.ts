// Draft engine: turns the raw data in data/players.json into projections, draft scores and
// pick recommendations. Pure functions, no DOM, so it runs in the browser and under node --test.
// Typed port of hockey-draft/src/engine.mjs: same exports, arguments, defaults and math.

// ---------- types ----------

export interface Weights {
  espnBlend: number;
  injuryCaution: number;
  injuryProne: number;
  trend: number;
  teamOffense: number;
  bigContract: number;
  bounceBack: number;
  rookie: number;
  stack: number;
}

/** Which list the rest of the pool drafts from (see marketOrder). */
export type Market = "pool" | "points" | "proj" | "espn";

export interface Settings {
  teams: number;
  rounds: number;
  /** 1-based draft slot, null until known */
  mySlot: number | null;
  market: Market;
  redraftDrops: number;
  weights: Weights;
}

/** One season in players.json: [season, teams, gp, g, a, pts, ppp, toi] */
export type HistTuple = [
  season: number,
  teams: string,
  gp: number,
  g: number,
  a: number,
  pts: number,
  ppp: number,
  toi: number,
];

export interface DraftInfo {
  year: number;
  round: number;
  overall: number;
}

/** ESPN's expected absence, counted against the team's schedule when the data was pulled */
export interface EspnOut {
  type?: string;
  back?: string;
  season?: boolean;
  games?: number;
}

export interface Espn {
  id: number;
  proj: number | null;
  g: number | null;
  a: number | null;
  gp: number | null;
  adp: number | null;
  rank: number | null;
  status: string;
  out?: EspnOut;
}

export interface Injury {
  status: string;
  note: string;
  date: string;
}

export type Pos = "C" | "L" | "R" | "D";

/** A skater as stored in players.json */
export interface Player {
  id: number;
  name: string;
  pos: Pos;
  team: string;
  prevTeam?: string | null;
  age: number | null;
  draft?: DraftInfo | null;
  careerGP: number | null;
  hist: HistTuple[];
  espn?: Espn | null;
  injury?: Injury | null;
  /** [player id, share of ice time together] */
  mates: [id: number, share: number][];
}

export interface TeamInfo {
  name?: string;
  gfpg?: number;
  gfpgPrev?: number;
  ppPct?: number;
}

/** data/players.json */
export interface PlayersFile {
  generatedAt: string;
  season: string;
  seasonGames: number;
  seasonStart: string;
  seasons: number[];
  sources: string[];
  teams: Record<string, TeamInfo>;
  players: Player[];
}

/** What prepare() reads from players.json */
export interface PrepareInput {
  seasons: number[];
  teams: Record<string, TeamInfo>;
  players: Player[];
  seasonGames?: number | undefined;
  seasonStart?: string | undefined;
  generatedAt?: string | undefined;
}

/** An entry in data/contracts.json */
export interface Contract {
  name: string;
  team: string;
  aav: number;
  years: number;
  type: string;
  newTeam: boolean;
  source: string;
  note?: string;
}

/** data/contracts.json */
export interface ContractsFile {
  asOf: string;
  about: string;
  contracts: Contract[];
}

/** A team's drafting lean, in the list's units (data/pool-teams.json) */
export interface Lean {
  list: number;
  projLean: number;
  D: number;
  young: number;
  vet: number;
}

export interface PoolTeam {
  name: string;
  seasons: number;
  lean: Lean;
  note: string;
}

/** data/pool-teams.json */
export interface PoolTeamsFile {
  source: string;
  teams: PoolTeam[];
}

/** A season row as prepare() builds it; back = seasons before last season */
export interface HistEntry {
  season: number;
  teams: string;
  gp: number;
  g: number;
  a: number;
  pts: number;
  ppp: number;
  toi: number;
  back: number;
}

export interface InjuryProne {
  bigMisses: number;
  seasons: number;
  avgMissed: number;
  gpLine: string;
}

export interface RecentRow {
  season: number;
  gp: number;
  ppg: number | null;
}

export interface Recent {
  rows: RecentRow[];
  change: number | null;
  before: number;
  priorSeason: number | null;
}

/** What scoringTrend() reads from each season */
export interface TrendInput {
  season: number;
  gp: number;
  pts: number;
  back: number;
}

export interface TrendPoint {
  season: number;
  gp: number;
  ppg: number;
  x: number;
}

export interface Trend {
  dir: -1 | 0 | 1;
  slope: number;
  rel: number;
  run: number;
  points: TrendPoint[];
}

/** A player with the per-player facts that don't depend on the weights */
export interface PreparedPlayer extends Omit<Player, "hist"> {
  hist: HistEntry[];
  lastRow: HistEntry | null;
  totalGP: number;
  neverPlayed: boolean;
  rookieEligible: boolean;
  histAvail: number | null;
  avgMissed: number;
  injuryProne: InjuryProne | null;
  trend: Trend | null;
  upside: number;
  recent: Recent | null;
  bounce: string | null;
  slumped: boolean;
  contract: Contract | null;
  teamGF: number;
  offenseRank: number;
  prevTeamGF: number | null;
}

/** Returned by prepare() */
export interface Ctx {
  seasons: number[];
  players: PreparedPlayer[];
  byId: Map<number, PreparedPlayer>;
  leagueGF: number;
  teamGF: Record<string, number>;
  offenseRank: Record<string, number>;
  seasonGames: number;
  seasonStart: string | undefined;
  teams: Record<string, TeamInfo>;
  generatedAt: string | undefined;
}

/** What gamesMissedNow() reads from a player */
export interface InjuryInput {
  injury?: Injury | null;
  espn?: { status?: string; out?: EspnOut } | null;
}

export interface OwnProjection {
  pts: number;
  rate: number;
  gp: number;
  avail?: number;
  missedNow: number;
  speculative: boolean;
}

export type TagKind =
  | "offense"
  | "contract"
  | "bounce"
  | "rookie"
  | "injury"
  | "rising"
  | "declining"
  | "hurt"
  | "moved"
  | "stack"
  | "value";

export interface Tag {
  k: TagKind;
  t: string;
  d: string;
  short?: string;
}

export interface Hurt {
  status: string;
  type: string | null;
  back: string | null;
  season: boolean;
  games: number;
  line: string;
  note: string | null;
  noteDate: string | null;
}

export interface StackWith {
  id: number;
  name: string;
  share: number;
}

/** One row of evaluate()'s list */
export interface Entry {
  p: PreparedPlayer;
  id: number;
  proj: number;
  own: number;
  espn: number | null;
  expGP: number;
  rate: number;
  missedNow: number;
  hurt: Hurt | null;
  healthy: number;
  speculative: boolean;
  score: number;
  mult: number;
  tags: Tag[];
  stackWith: StackWith | null;
  taken: boolean;
  ceiling: number;
  rank: number;
  marketRank: number;
}

type EntryBase = Omit<Entry, "ceiling" | "rank" | "marketRank">;

/** overrides.contract: { [playerId]: true | false } lets the user flag or clear a big contract. */
export interface Overrides {
  contract?: Record<number, boolean>;
}

export interface Evaluation {
  list: Entry[];
  byId: Map<number, Entry>;
  redraftLevel: number;
}

/** What marketOrder() reads from each entry */
export interface MarketItem {
  proj: number;
  espn: number | null;
  healthy?: number;
  p: { lastRow: { pts: number } | null; espn?: { adp: number | null } | null };
}

export interface DraftStatus {
  total: number;
  current: number;
  done: boolean;
  round: number;
  pickInRound: number;
  onClock: number | null;
  myTurn: boolean;
  nextMine: number | undefined;
  picksUntilMine: number | null;
  afterThat: number | undefined;
  mine: number[];
}

/** A pick made in the draft; id null for a player not on the list */
export interface DraftPick {
  id: number | null;
  label?: string;
  followed?: boolean;
}

export interface RecommendOptions {
  top?: number;
  pool?: number;
  depth?: number;
  avoid?: ReadonlySet<number>;
}

export interface ScoredPick {
  e: Entry;
  ev: number;
  nextEV: number;
  reach: number;
  lastsToNext: number;
}

export interface RecPick extends ScoredPick {
  reasons: string[];
}

export interface ChancePick {
  e: Entry;
  reach: number;
  lastsToNext: number;
  reasons: string[];
}

export interface ReachEntry {
  e: Entry;
  reach: number;
}

export interface Recommendation {
  status: DraftStatus;
  picks: RecPick[];
  chance: ChancePick | null;
  targets: ReachEntry[];
  goners: ReachEntry[];
  between: number | null;
  reachById: Map<number, number | null>;
}

export interface CpuTeam {
  style: Market;
  noise?: number;
  lean?: Partial<Lean>;
  note?: string;
}

export type MarketOrders = Partial<Record<Market, readonly Entry[]>>;

/** Each computer team's board, keyed by slot */
export type CpuBoards = Record<string, Entry[]>;

export interface TeamTotal {
  slot: number;
  total: number;
  players: { e: Entry; pick: number }[];
}

// ---------- settings ----------

export const DEFAULT_WEIGHTS: Weights = {
  espnBlend: 0.5, // 0 = only our 3-season model, 1 = only ESPN's projection
  injuryCaution: 1, // how much a player's games-missed history lowers his expected games
  injuryProne: 0.04, // extra penalty for a chronic pattern of missed games (the risk itself)
  trend: 0.5, // how much a multi-season rise or decline in points per game moves a player
  teamOffense: 0.3, // bonus/penalty for playing on a high/low scoring team
  bigContract: 0.05, // penalty for a player starting a big new contract
  bounceBack: 0.04, // bonus for a player coming off an injury- or slump-shortened season
  rookie: 0.03, // bonus for rookies who have never played an NHL game (upside)
  stack: 0.06, // bonus for a linemate / PP mate of a player already on my team
};

export const DEFAULT_SETTINGS: Settings = {
  teams: 15, // last season's pool; change in Settings if this year's differs
  rounds: 10,
  mySlot: null, // 1-based draft slot; unknown until right before the draft
  // How the rest of the pool drafts: "pool" (last season's points, or ESPN's projected points
  // when higher), "points" (last season's points), "proj" (ESPN projected points) or "espn"
  // (ESPN ADP). The pool's own drafts (2022-23 to 2025-26) fit "pool" best.
  market: "pool",
  // Players each team can drop and replace at the All-Star break. A dropped player's points go
  // with him and the new player's whole season counts, so a late-round bust costs little: the
  // last this-many rounds add a take-a-chance pick. 0 turns it off.
  redraftDrops: 2,
  weights: DEFAULT_WEIGHTS,
};

const PAST_SEASON_GAMES = 82;
const RATE_WEIGHTS = [5, 3, 2]; // points per game: last season, the one before, the one before that
const AVAIL_WEIGHTS = [5, 4, 3, 2, 1]; // games played: all five seasons, most recent first
const REGRESS_GAMES = 25;
const LEAGUE_RATE = { F: 0.4, D: 0.25 };
const TYPICAL_AVAILABILITY = 0.92;
const GAMES_PER_WEEK = 3.1;
const STACK_SHARE = 0.35; // share of a player's ice time spent with a teammate to call them mates

// ---------- small helpers ----------

export const isD = (p: { pos: string }): boolean => p.pos === "D";
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
// Standard normal density and distribution
const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
function Phi(x: number): number {
  // Abramowitz and Stegun 7.1.26 for erf(|x|/sqrt 2)
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-x * x) / 2);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
const round1 = (x: number) => Math.round(x * 10) / 10;
const seasonsBack = (season: number, last: number) => Math.round((last - season) / 10001);
const fmtSeason = (s: number): string => `${String(s).slice(2, 4)}-${String(s).slice(6, 8)}`;

export function normName(s: string | null | undefined): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
}

export function ageMultiplier(age: number | null | undefined): number {
  if (age == null) return 1;
  const a = Math.floor(age);
  if (a <= 20) return 1.12;
  if (a === 21) return 1.08;
  if (a === 22) return 1.05;
  if (a === 23) return 1.03;
  if (a === 24) return 1.01;
  if (a <= 28) return 1;
  if (a === 29) return 0.99;
  if (a === 30) return 0.97;
  if (a === 31) return 0.95;
  if (a === 32) return 0.93;
  if (a === 33) return 0.91;
  if (a === 34) return 0.89;
  return 0.86;
}

// ---------- snake draft math ----------

export function slotForPick(pick: number, teams: number): number {
  const round = Math.floor(pick / teams);
  const i = pick % teams;
  return round % 2 === 0 ? i + 1 : teams - i;
}

export function myPickNumbers(slot: number | null, teams: number, rounds: number): number[] {
  if (!slot) return [];
  const out: number[] = [];
  for (let r = 0; r < rounds; r++) {
    out.push(r * teams + (r % 2 === 0 ? slot - 1 : teams - slot));
  }
  return out;
}

// ---------- current injuries ----------

const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  several: 4,
  few: 3,
  couple: 2,
};

// Games a player is expected to miss at the start of the season. ESPN's expected return date,
// counted against his team's schedule when the data was pulled, comes first; otherwise the
// injury note is read for a timeline.
export function gamesMissedNow(
  p: InjuryInput,
  seasonStart: string | null | undefined,
  seasonGames: number,
): number {
  const inj = p.injury;
  const status = (inj?.status || p.espn?.status || "").toLowerCase();
  if (!status || status === "active") return 0;
  const out = p.espn?.out;
  if (out?.season) return seasonGames;
  if (out && out.games != null) return clamp(out.games, 0, seasonGames);
  const note = (inj?.note || "").toLowerCase();
  if (/season-ending|rest of the (2026-27 )?season|miss the (entire )?season/.test(note))
    return seasonGames;
  const num = "(\\d+|" + Object.keys(WORD_NUM).join("|") + ")";
  const m = note.match(
    new RegExp(`${num}(?:\\s*(?:-|to|or)\\s*${num})?\\s*(day|week|month)s?`, "i"),
  );
  if (m && !/day-to-day|week-to-week/.test(m[0])) {
    const val = (s: string | undefined) => (s ? (WORD_NUM[s] ?? Number(s)) : null);
    const lo = val(m[1]);
    const hi = val(m[2]) ?? lo;
    const unitDays = ({ day: 1, week: 7, month: 30.4 } as Record<string, number>)[m[3]!]!;
    const outDays = ((lo! + hi!) / 2) * unitDays;
    const noteDate = inj?.date ? new Date(inj.date) : new Date();
    const start = seasonStart ? new Date(seasonStart) : noteDate;
    const daysIntoSeason = (noteDate.getTime() - start.getTime()) / 864e5 + outDays;
    return clamp(Math.round((daysIntoSeason / 7) * GAMES_PER_WEEK), 0, seasonGames);
  }
  if (/october/.test(note) && /rehab|miss|out/.test(note)) return 10;
  if (/indefinitely|long-term|long term|surgery/.test(note)) return 20;
  if (/week-to-week/.test(note)) return 4;
  if (status.includes("reserve") || status === "injury_reserve") return 6;
  if (status === "suspension") return 2;
  return 0; // "Out" for a preseason game, day-to-day
}

// ---------- per-player facts that do not depend on the weights ----------

// A season with a regular role, or a whole season missed right after one
interface SeasonGP {
  season: number;
  gp: number;
  back: number;
  missedAll?: true;
}

export function prepare(data: PrepareInput, contracts: readonly Contract[] = []): Ctx {
  const last = data.seasons[data.seasons.length - 1]!;
  const contractByName = new Map(contracts.map((c): [string, Contract] => [normName(c.name), c]));

  // Team offense: last season weighted 70/30 with the one before
  const teamGF: Record<string, number> = {};
  for (const [tri, t] of Object.entries(data.teams)) {
    teamGF[tri] = t.gfpg && t.gfpgPrev ? 0.7 * t.gfpg + 0.3 * t.gfpgPrev : t.gfpg || 3;
  }
  const leagueGF = Object.values(teamGF).reduce((a, b) => a + b, 0) / Object.keys(teamGF).length;
  const offenseRank: Record<string, number> = Object.fromEntries(
    Object.entries(teamGF)
      .sort((a, b) => b[1] - a[1])
      .map(([tri], i): [string, number] => [tri, i + 1]),
  );

  const players = data.players.map((raw): PreparedPlayer => {
    const hist: HistEntry[] = raw.hist.map(([season, teams, gp, g, a, pts, ppp, toi]) => ({
      season,
      teams,
      gp,
      g,
      a,
      pts,
      ppp,
      toi,
      back: seasonsBack(season, last),
    }));
    hist.sort((a, b) => a.season - b.season);
    const lastRow = hist.find((h) => h.back === 0) || null;
    const prior = hist.filter((h) => h.back === 1 || h.back === 2);
    const totalGP = hist.reduce((s, h) => s + h.gp, 0);
    const neverPlayed = raw.careerGP === 0 && totalGP === 0;
    const rookieEligible = !neverPlayed && totalGP < 25 && (raw.age ?? 99) < 26;

    // Availability over five seasons. Only seasons where he had a regular role count, so AHL
    // time doesn't read as injury; a young player's partial season is usually a call-up, not an
    // injury, so those are left out too.
    const regular: SeasonGP[] = hist.filter((h) => {
      if (h.gp < 10 || h.toi < (raw.pos === "D" ? 900 : 780)) return false;
      const ageThen = raw.age != null ? raw.age - 0.7 - h.back : 30;
      return !(ageThen < 23 && h.gp < 70);
    });
    // A whole season missing right after a regular one (Barkov's 2025-26, say) counts as a
    // season of 0 games; he wouldn't show up in that season's stats at all.
    for (const season of data.seasons) {
      if (hist.some((h) => h.season === season)) continue;
      const prev = regular.find((h) => h.season === season - 10001);
      if (prev) regular.push({ season, gp: 0, back: seasonsBack(season, last), missedAll: true });
    }
    regular.sort((a, b) => a.season - b.season);
    let availNum = 0;
    let availDen = 0;
    for (const h of regular) {
      const w = AVAIL_WEIGHTS[h.back] ?? 1;
      availNum += w * Math.min(1, h.gp / PAST_SEASON_GAMES);
      availDen += w;
    }
    const histAvail = availDen ? availNum / availDen : null;
    const missed = regular.map((h) => Math.max(0, PAST_SEASON_GAMES - h.gp));
    const avgMissed = missed.length ? missed.reduce((a, b) => a + b, 0) / missed.length : 0;
    const bigMisses = missed.filter((m) => m >= 20).length;
    // A pattern, not one bad break: 20+ games missed twice, or a typical (median) season of
    // 14+ missed games. One long injury in an otherwise healthy run doesn't count.
    const medianMissed = missed.length ? [...missed].sort((a, b) => a - b)[missed.length >> 1]! : 0;
    const injuryProne: InjuryProne | null =
      regular.length >= 2 && (bigMisses >= 2 || (regular.length >= 3 && medianMissed >= 14))
        ? {
            bigMisses,
            seasons: regular.length,
            avgMissed,
            gpLine: regular.map((h) => `${fmtSeason(h.season)}: ${h.gp}`).join(" · "),
          }
        : null;

    // Bounce-back: last season well below his established level, by rate or by games
    let bounce: string | null = null;
    let slumped = false;
    const priorGP = prior.reduce((s, h) => s + h.gp, 0);
    const priorPPG = priorGP ? prior.reduce((s, h) => s + h.pts, 0) / priorGP : 0;
    if (lastRow && priorGP >= 60 && priorPPG >= 0.5) {
      const lastPPG = lastRow.gp ? lastRow.pts / lastRow.gp : 0;
      const priorAvgGP = priorGP / prior.length;
      if (lastRow.gp >= 20 && lastPPG < 0.8 * priorPPG) {
        bounce = `Slumped to ${lastPPG.toFixed(2)} pts/gm last season after ${priorPPG.toFixed(2)} the two before`;
        slumped = true;
      } else if (lastRow.gp < 62 && priorAvgGP >= 65 && lastPPG >= 0.8 * priorPPG) {
        bounce = `Only ${lastRow.gp} GP last season (still ${lastPPG.toFixed(2)} pts/gm) after ${Math.round(priorAvgGP)} GP/season before`;
      }
    } else if (!lastRow && priorGP >= 60 && priorPPG >= 0.5) {
      bounce = `Missed all of last season; ${priorPPG.toFixed(2)} pts/gm before that`;
    }

    // Points per game in each of the last three seasons (from his first NHL season on), and
    // last season against the ones before it, games-weighted
    const first = hist[0]?.season;
    const recentRows: RecentRow[] = data.seasons
      .slice(-3)
      .filter((season) => first && season >= first)
      .map((season) => {
        const h = hist.find((r) => r.season === season);
        return { season, gp: h?.gp ?? 0, ppg: h?.gp ? h.pts / h.gp : null };
      });
    const recent: Recent | null = recentRows.length
      ? {
          rows: recentRows,
          change:
            lastRow && lastRow.gp >= 10 && priorGP >= 20 && priorPPG > 0
              ? lastRow.pts / lastRow.gp / priorPPG - 1
              : null,
          before: prior.length,
          priorSeason: prior.length === 1 ? prior[0]!.season : null,
        }
      : null;

    const trend = scoringTrend(hist, bounce);
    const contract = contractByName.get(normName(raw.name)) || null;

    // How far above his projection a good season (about 1 in 5) goes. A backtest of 2024-25 and
    // 2025-26 against the three seasons before each: about +20% for established players, +25%
    // under 24, +45% or more with under a full season of NHL games. Injury-prone players have
    // more room too, since a healthy season is well above a projection that expects missed games.
    const nhlGP = raw.careerGP ?? totalGP;
    let upside = neverPlayed ? 0.5 : nhlGP < 82 ? 0.45 : (raw.age ?? 30) < 24 ? 0.28 : 0.2;
    if (injuryProne) upside += 0.1;
    return {
      ...raw,
      hist,
      lastRow,
      totalGP,
      neverPlayed,
      rookieEligible,
      histAvail,
      avgMissed,
      injuryProne,
      trend,
      upside,
      recent,
      bounce,
      slumped,
      contract,
      teamGF: teamGF[raw.team] ?? leagueGF,
      offenseRank: offenseRank[raw.team] ?? 16,
      prevTeamGF: raw.prevTeam ? (teamGF[raw.prevTeam] ?? null) : null,
    };
  });

  const byId = new Map(players.map((p): [number, PreparedPlayer] => [p.id, p]));
  return {
    seasons: data.seasons,
    players,
    byId,
    leagueGF,
    teamGF,
    offenseRank,
    seasonGames: data.seasonGames || 82,
    seasonStart: data.seasonStart,
    teams: data.teams,
    generatedAt: data.generatedAt,
  };
}

// "Points per game 1.10 → 1.08 → 0.79 (23-24 to 25-26): last season down 27% on the two
// before". Short seasons carry their games played so a 12-game spike doesn't read as a trend.
export function recentLine(p: { recent: Recent | null }): string | null {
  const r = p.recent;
  if (!r) return null;
  const vals = r.rows
    .map((x) =>
      x.ppg == null ? "no NHL games" : `${x.ppg.toFixed(2)}${x.gp < 40 ? ` (${x.gp} GP)` : ""}`,
    )
    .join(" → ");
  const a = fmtSeason(r.rows[0]!.season);
  const b = fmtSeason(r.rows[r.rows.length - 1]!.season);
  let line = `Points per game ${vals} (${a === b ? a : `${a} to ${b}`})`;
  if (r.change != null) {
    const pct = Math.round(Math.abs(r.change) * 100);
    const vs = r.before >= 2 ? "the two before" : fmtSeason(r.priorSeason!);
    line +=
      pct < 5
        ? `: last season about level with ${vs}`
        : `: last season ${r.change > 0 ? "up" : "down"} ${pct}% on ${vs}`;
  }
  return line;
}

// Is his scoring rising or falling over the last five seasons? Fits a games-weighted line through
// points per game (seasons with 20+ GP) and counts how many years in a row it has moved the same
// way. dir is 1 (rising), -1 (declining) or 0 (flat or mixed).
export function scoringTrend(
  hist: readonly TrendInput[],
  bounce: string | null = null,
): Trend | null {
  const q = hist.filter((h) => h.gp >= 20).sort((a, b) => a.season - b.season);
  if (q.length < 3 || q[q.length - 1]!.back > 1) return null;
  const pts = q.map((h) => ({ season: h.season, gp: h.gp, ppg: h.pts / h.gp, x: -h.back }));
  const W = pts.reduce((s, p) => s + p.gp, 0);
  const mx = pts.reduce((s, p) => s + p.gp * p.x, 0) / W;
  const my = pts.reduce((s, p) => s + p.gp * p.ppg, 0) / W;
  const sxx = pts.reduce((s, p) => s + p.gp * (p.x - mx) ** 2, 0);
  const slope = sxx ? pts.reduce((s, p) => s + p.gp * (p.x - mx) * (p.ppg - my), 0) / sxx : 0;
  const rel = slope / Math.max(my, 0.15); // share of his typical rate gained or lost per season

  // Consecutive year-over-year moves in the same direction, ending with the latest season
  let run = 0;
  let runDir = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    const d = pts[i]!.ppg - pts[i - 1]!.ppg;
    if (Math.abs(d) < 0.02) break;
    const sgn = Math.sign(d);
    if (run === 0) runDir = sgn;
    else if (sgn !== runDir) break;
    run++;
  }
  const lastMove = pts[pts.length - 1]!.ppg - pts[pts.length - 2]!.ppg;

  let dir: -1 | 0 | 1 = 0;
  if ((run >= 2 && runDir > 0 && rel > 0.05) || rel >= 0.1) dir = 1;
  if ((run >= 2 && runDir < 0 && rel < -0.05) || rel <= -0.1) dir = -1;
  // A sharp move against the trend last season makes it mixed, not a trend
  if (dir !== 0 && Math.sign(lastMove) !== dir && Math.abs(lastMove) > 0.1) dir = 0;
  // One bad season after a steady run is a bounce-back candidate, not a decline
  if (dir === -1 && bounce && run < 2) dir = 0;
  return { dir, slope, rel, run: runDir === dir ? run : 0, points: pts };
}

// ---------- projection ----------

// Our own model: GP-weighted points-per-game over three seasons (5/3/2), regressed toward a
// league rate, adjusted for age and a team change, times the games we expect him to play.
export function projectOwn(p: PreparedPlayer, ctx: Ctx, w: Weights): OwnProjection {
  const games = ctx.seasonGames;
  const missedNow = gamesMissedNow(p, ctx.seasonStart, games);
  if (!p.hist.length) {
    // Never played in the NHL: a rough prospect rate from draft slot
    const o = p.draft?.overall ?? 200;
    let rate = o <= 5 ? 0.5 : o <= 15 ? 0.38 : o <= 32 ? 0.3 : o <= 64 ? 0.22 : 0.16;
    if (isD(p)) rate *= 0.65;
    const gp = Math.max(0, 50 - missedNow);
    return { pts: rate * gp, rate, gp, missedNow, speculative: true };
  }
  let num = 0;
  let den = 0;
  for (const h of p.hist) {
    const wt = RATE_WEIGHTS[h.back] ?? 0;
    num += wt * h.pts;
    den += wt * h.gp;
  }
  const lg = isD(p) ? LEAGUE_RATE.D : LEAGUE_RATE.F;
  let rate = (num + REGRESS_GAMES * lg) / (den + REGRESS_GAMES);
  rate *= ageMultiplier(p.age);
  if (p.prevTeamGF && p.teamGF) rate *= Math.sqrt(p.teamGF / p.prevTeamGF);

  const hist = p.histAvail ?? TYPICAL_AVAILABILITY;
  const k = clamp(0.6 * w.injuryCaution, 0, 1);
  const avail = clamp(k * hist + (1 - k) * TYPICAL_AVAILABILITY, 0.5, 0.98);
  // Players who were not regulars last season get fewer expected games
  const regularLast = p.lastRow && p.lastRow.gp >= 40;
  const roleGames = regularLast || p.totalGP >= 120 ? games : Math.min(games, 60);
  const gp = Math.max(0, Math.min(roleGames, games * avail) - missedNow);
  return { pts: rate * gp, rate, gp, avail, missedNow, speculative: false };
}

export function projectEspn(p: PreparedPlayer, ctx: Ctx, missedNow: number): number | null {
  const e = p.espn;
  if (!e || e.proj == null) return null;
  const gp = e.gp || ctx.seasonGames;
  const canPlay = Math.max(0, ctx.seasonGames - missedNow);
  return e.proj * Math.min(1, canPlay / gp);
}

// ---------- evaluation: projection, score, tags ----------

// "2026-10-24" -> "Oct 24"
export function shortDate(iso: string): string {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}`;
}
const STATUS_WORDS: Record<string, string> = {
  out: "Out",
  injury_reserve: "Injured reserve",
  "injured reserve": "Injured reserve",
  day_to_day: "Day-to-day",
  "day-to-day": "Day-to-day",
  suspension: "Suspended",
  suspended: "Suspended",
};
// What's wrong, when he's back and what it costs, for the pick card's warning
function hurtSummary(p: PreparedPlayer, status: string, games: number): Hurt {
  const out: EspnOut = p.espn?.out || {};
  // ESPN's player list is current; the injuries feed's own status can be an older copy
  const now = p.espn?.status && p.espn.status !== "ACTIVE" ? p.espn.status : status;
  const word = STATUS_WORDS[String(now).toLowerCase()] || now;
  const type = out.type && out.type !== "Suspension" ? out.type : null;
  const line = out.season
    ? "Out for the season"
    : out.back
      ? games
        ? `Expected back ${shortDate(out.back)}, missing about ${games} of ${p.team}'s games`
        : `Expected back ${shortDate(out.back)}, before ${p.team}'s next game`
      : games
        ? `Likely to miss about ${games} games`
        : "No timeline yet";
  return {
    status: word,
    type,
    back: out.back || null,
    season: !!out.season,
    games,
    line,
    note: p.injury?.note || null,
    noteDate: p.injury?.date ? p.injury.date.slice(0, 10) : null,
  };
}

// A contract as the "contract" tag reads it: a real one, or { aav: null } when the user flags him
interface ContractLike {
  aav: number | null;
  years?: number;
  type?: string;
  newTeam?: boolean;
}

// overrides.contract: { [playerId]: true | false } lets the user flag or clear a big contract.
export function evaluate(
  ctx: Ctx,
  settings: Settings,
  takenIds: ReadonlySet<number>,
  myIds: Iterable<number>,
  overrides: Overrides = {},
): Evaluation {
  const w = { ...DEFAULT_WEIGHTS, ...(settings.weights || {}) };
  const mine = [...myIds]
    .map((id) => ctx.byId.get(id))
    .filter((q): q is PreparedPlayer => Boolean(q));
  const projections = ctx.players.map((p) => {
    const own = projectOwn(p, ctx, w);
    return { p, own, espn: projectEspn(p, ctx, own.missedNow) };
  });
  // ESPN only projects the top ~320 skaters. So players past that don't fall off a cliff at
  // the boundary, put our model on ESPN's scale for them using the median ratio where we have both.
  const ratios = projections
    .filter((x) => x.espn != null && !x.own.speculative && x.own.pts > 20)
    .map((x) => x.espn! / x.own.pts)
    .sort((a, b) => a - b);
  const calib = ratios.length ? ratios[Math.floor(ratios.length / 2)]! : 1;

  const out = projections.map(({ p, own, espn }) => {
    let proj: number;
    if (espn != null && !own.speculative) proj = (1 - w.espnBlend) * own.pts + w.espnBlend * espn;
    else if (espn != null) proj = espn;
    else proj = own.pts * (1 - w.espnBlend + w.espnBlend * calib);

    let mult = 1;
    const tags: Tag[] = [];

    const off = p.teamGF / ctx.leagueGF - 1;
    mult *= 1 + w.teamOffense * off;
    if (p.offenseRank <= 8)
      tags.push({
        k: "offense",
        t: `Top-8 offense`,
        d: `${p.team} scored ${p.teamGF.toFixed(2)} goals/game (#${p.offenseRank} in the NHL)`,
      });

    const ov = overrides.contract?.[p.id];
    const c: ContractLike | null =
      ov === false ? null : ov === true ? p.contract || { aav: null } : p.contract;
    if (c) {
      mult *= 1 - w.bigContract;
      tags.push(
        c.aav
          ? {
              k: "contract",
              t: `New $${c.aav}M deal`,
              d: `${c.years}-yr, $${c.aav}M/yr ${c.type || "contract"} starting this season${c.newTeam ? " with a new team" : ""}`,
            }
          : {
              k: "contract",
              t: "Big new deal",
              d: "You flagged him as starting a big new contract",
            },
      );
    }
    if (p.bounce) {
      mult *= 1 + w.bounceBack;
      tags.push({ k: "bounce", t: "Bounce-back", d: p.bounce });
    }
    if (p.neverPlayed) {
      mult *= 1 + w.rookie;
      const dr = p.draft ? ` · ${p.draft.year} draft, #${p.draft.overall} overall` : "";
      tags.push({ k: "rookie", t: "Rookie · 0 NHL GP", d: `Has never played an NHL game${dr}` });
    } else if (p.rookieEligible) {
      tags.push({
        k: "rookie",
        t: `Rookie · ${p.totalGP} GP`,
        d: `Still rookie-eligible: ${p.totalGP} NHL games so far`,
      });
    }
    if (p.injuryProne) {
      const ip = p.injuryProne;
      mult *= 1 - w.injuryProne;
      tags.push({
        k: "injury",
        t: `Injury-prone · ~${Math.round(ip.avgMissed)} gms missed/yr`,
        d:
          `${ip.bigMisses ? `Missed 20+ games in ${ip.bigMisses} of the last ${ip.seasons} seasons. ` : ""}` +
          `Averages ${Math.round(ip.avgMissed)} missed games a year (games played ${ip.gpLine}).`,
      });
    }
    const tr = p.trend;
    if (tr && tr.dir !== 0) {
      mult *= 1 + w.trend * clamp(tr.rel, -0.2, 0.2);
      const up = tr.dir > 0;
      const pct = Math.round(Math.abs(tr.rel) * 100);
      const line = tr.points.map((x) => x.ppg.toFixed(2)).join(" → ");
      const span = `${fmtSeason(tr.points[0]!.season)} to ${fmtSeason(tr.points[tr.points.length - 1]!.season)}`;
      tags.push({
        k: up ? "rising" : "declining",
        t:
          tr.run >= 2
            ? `${up ? "Rising" : "Declining"} ${tr.run} yrs straight`
            : `Trending ${up ? "up" : "down"}`,
        d: `Points per game ${line} (${span}): about ${up ? "+" : "−"}${pct}% a season`,
        short: `Five-season trend: ${up ? "rising" : "declining"}${tr.run >= 2 ? ` ${tr.run} years straight` : ""}, about ${up ? "+" : "−"}${pct}% a season since ${fmtSeason(tr.points[0]!.season)}`,
      });
    }
    const injStatus = p.injury?.status || (p.espn?.status !== "ACTIVE" ? p.espn?.status : null);
    const hurt = injStatus ? hurtSummary(p, injStatus, own.missedNow) : null;
    if (hurt) {
      tags.push({
        k: "hurt",
        t: hurt.season
          ? "Out for season"
          : hurt.back && own.missedNow
            ? `Hurt · back ${shortDate(hurt.back)}`
            : own.missedNow
              ? `Hurt · ~${own.missedNow} gms`
              : `Hurt · ${hurt.status}`,
        d: hurt.line + (p.injury?.note ? `. ${p.injury.note}` : ""),
      });
    }
    if (p.prevTeam) {
      tags.push({
        k: "moved",
        t: `New team (from ${p.prevTeam})`,
        d: `Played for ${p.prevTeam} last season`,
      });
    }

    // Stacking: shares a line or PP unit with someone already on my team
    let stackWith: StackWith | null = null;
    for (const q of mine) {
      if (q.id === p.id) continue;
      const a = p.mates.find(([id]) => id === q.id)?.[1] ?? 0;
      const b = q.mates.find(([id]) => id === p.id)?.[1] ?? 0;
      const share = Math.max(a, b);
      if (share >= STACK_SHARE && (!stackWith || share > stackWith.share))
        stackWith = { id: q.id, name: q.name, share };
    }
    if (stackWith) {
      mult *= 1 + w.stack;
      tags.push({
        k: "stack",
        t: `Stacks with ${stackWith.name.split(" ").slice(-1)[0]}`,
        d: `On the ice for ${Math.round(stackWith.share * 100)}% of the same shifts as ${stackWith.name} (your pick)`,
      });
    }

    const entry: EntryBase = {
      p,
      id: p.id,
      proj: round1(proj),
      own: round1(own.pts),
      espn: espn != null ? round1(espn) : null,
      expGP: Math.round(own.gp),
      rate: own.rate,
      missedNow: own.missedNow,
      hurt,
      // Share of the season he's healthy for, given current injuries
      healthy: Math.max(0, 1 - own.missedNow / ctx.seasonGames),
      speculative: own.speculative && espn == null,
      score: round1(proj * mult),
      mult,
      tags,
      stackWith,
      taken: takenIds.has(p.id),
    };
    // ceiling, rank and marketRank are filled in below
    return entry as Entry;
  });

  // A good season (about 1 in 5) for each player
  for (const e of out) e.ceiling = round1(e.proj * (1 + e.p.upside));

  // Rank by our score, and by the market so we can spot value
  const sorted = [...out].sort((a, b) => b.score - a.score);
  sorted.forEach((e, i) => (e.rank = i + 1));
  const market = marketOrder(out, settings.market);
  market.forEach((e, i) => (e.marketRank = i + 1));
  const vs = VALUE_VS[settings.market] || VALUE_VS.espn;
  for (const e of out) {
    const basis = vs.basis(e);
    if (basis != null && e.marketRank - e.rank >= 25 && e.rank <= 300) {
      e.tags.push({
        k: "value",
        t: vs.t,
        d: `We rank him #${e.rank}; ${vs.d(e.marketRank, basis)}`,
      });
    }
  }
  return {
    list: sorted,
    byId: new Map(out.map((e): [number, Entry] => [e.id, e])),
    redraftLevel: redraftLevel(out, settings),
  };
}

// Spread of a player's season around his projection, from his good-season upside
const spreadOf = (e: Entry) => Math.max(3, (e.proj * e.p.upside) / 0.84);

// Roughly what a team picks up in the All-Star redraft, counted as a full season (the new
// player's whole season counts). Undrafted players are everyone past teams x rounds; in a
// two-round serpentine the average pickup is about the teams-th best of them, so this is the
// level that that many of them are expected to beat.
function redraftLevel(out: Entry[], settings: Settings): number {
  const drafted = settings.teams * settings.rounds;
  const pool = [...out].sort((a, b) => b.proj - a.proj).slice(drafted);
  if (!pool.length) return 0;
  const above = (lvl: number) =>
    pool.reduce((n, e) => n + 1 - Phi((lvl - e.proj) / spreadOf(e)), 0);
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (above(mid) > settings.teams) lo = mid;
    else hi = mid;
  }
  return round1((lo + hi) / 2);
}

// What a late pick is worth when a bust can be swapped for a redraft pickup: his season if he
// beats the pickup, the pickup's otherwise.
export function insuredValue(e: Entry, level: number): number {
  const sd = spreadOf(e);
  const d = (e.proj - level) / sd;
  return level + sd * phi(d) + (e.proj - level) * Phi(d);
}

// The "Value" tag, worded for whichever list the rest of the pool drafts from
interface ValueVs {
  t: string;
  basis: (e: Entry) => number | null;
  d: (m: number, v: number) => string;
}
const VALUE_VS: Record<Market, ValueVs> = {
  espn: {
    t: "Value vs ADP",
    basis: (e) => e.p.espn?.adp ?? null,
    d: (m, adp) => `the market has him around #${m} (ESPN ADP ${adp})`,
  },
  proj: {
    t: "Value vs projections",
    basis: (e) => (e.espn != null ? Math.round(e.espn) : null),
    d: (m, pts) => `ESPN's projected points put him #${m} (${pts} pts)`,
  },
  points: {
    t: "Value vs last season",
    basis: (e) => e.p.lastRow?.pts ?? null,
    d: (m, pts) => `last season's points put him #${m} (${pts} pts)`,
  },
  pool: {
    t: "Value vs the pool",
    basis: (e) => Math.round(poolPts(e)),
    d: (m, pts) =>
      `the pool's usual list (last season's points, or ESPN's projection if higher) has him #${m} (${pts} pts)`,
  },
};
export const valueLabel = (market: Market): string => (VALUE_VS[market] || VALUE_VS.espn).t;

// How the rest of the pool is likely to draft. "espn": by ESPN average draft position, then by
// ESPN's projection for anyone without one. "proj": by ESPN's projected points, falling back to
// ours for players ESPN doesn't project (a points pool drafting off a projections list).
// "points": by last season's points, cut for games a current injury will cost him (a pool
// passes on hurt players). "pool": the better of that and ESPN's projection (ours if ESPN has
// none), which is how this pool has drafted: most players on what they scored, rookies and
// players coming off a short season on their projection.
const lastPtsNow = (e: MarketItem) => (e.p.lastRow?.pts ?? 0) * (e.healthy ?? 1);
const poolPts = (e: MarketItem) => Math.max(lastPtsNow(e), e.espn ?? e.proj);
export function marketOrder<T extends MarketItem>(
  entries: readonly T[],
  model: Market = "espn",
): T[] {
  const lastPts = lastPtsNow;
  if (model === "points") {
    return [...entries].sort((a, b) => lastPts(b) - lastPts(a) || b.proj - a.proj);
  }
  if (model === "pool") {
    return [...entries].sort((a, b) => poolPts(b) - poolPts(a) || b.proj - a.proj);
  }
  if (model === "proj") {
    const pts = (e: T) => e.espn ?? e.proj;
    const adp = (e: T) => e.p.espn?.adp ?? 999;
    return [...entries].sort((a, b) => pts(b) - pts(a) || adp(a) - adp(b));
  }
  return [...entries].sort((a, b) => {
    const aa = a.p.espn?.adp ?? null;
    const bb = b.p.espn?.adp ?? null;
    if (aa != null && bb != null) return aa - bb;
    if (aa != null) return -1;
    if (bb != null) return 1;
    return (b.espn ?? b.proj) - (a.espn ?? a.proj);
  });
}

// Probability a player is still there after `n` other picks. `m` is his position among the
// players still available on the market list (0 = next), `o` how many picks the pool has made
// since his place on the list came up (how long it has passed him over), and `r` his place on
// the full list (0 = top). Fitted to the pool's own drafts, 2022-23 to 2025-26 (640 picks,
// "pool" list, the top 60 players available by projection at each pick):
// - people stray a long way from any list, less so at the top: the spread grows with n and
//   with how far down the list he is, so stars go close to on schedule
// - a player the pool keeps passing over tends to keep being passed over (often he's hurt, or
//   they just don't rate him), but that fades for the top of the list, which never slides far
const SURVIVAL = {
  spread: 10,
  perPick: 0.3,
  rankScale: 0.73,
  rankOffset: 15,
  overdue: 0.625,
  fadeTo: 60,
  shift: 4.8,
};
export function survival(m: number, n: number, o = 0, r = 60): number {
  if (n <= 0) return 1;
  const S = SURVIVAL;
  const spread = (S.spread + S.perPick * n) * Math.pow((r + S.rankOffset) / 60, S.rankScale);
  const passed = S.overdue * o * Math.min(1, ((r + 1) / S.fadeTo) ** 2);
  const x = (n - (m + passed) - 0.5 - S.shift) / spread;
  return 1 / (1 + Math.exp(1.7 * x));
}

// ---------- the draft state ----------

// Only picks.length is read, so any list of picks works.
export function draftStatus(settings: Settings, picks: readonly unknown[]): DraftStatus {
  const { teams, rounds, mySlot } = settings;
  const total = teams * rounds;
  const current = picks.length;
  const mine = myPickNumbers(mySlot, teams, rounds);
  const nextMine = mine.find((n) => n >= current);
  const afterThat = nextMine == null ? undefined : mine.find((n) => n > nextMine);
  return {
    total,
    current,
    done: current >= total,
    round: Math.floor(current / teams) + 1,
    pickInRound: (current % teams) + 1,
    onClock: current < total ? slotForPick(current, teams) : null,
    myTurn: nextMine === current,
    nextMine,
    picksUntilMine: nextMine == null ? null : nextMine - current,
    afterThat,
    mine,
  };
}

// ---------- recommendation ----------

// Recommend a pick for my upcoming turn. For each candidate X we add X's score to the expected
// score of the best player still there at my following pick, if I take X now. That is what makes
// it say "take the guy who won't come back, the other one will still be there".
export function recommend(
  evaluation: Evaluation,
  settings: Settings,
  picks: readonly unknown[],
  { top = 3, pool = 12, depth = 45, avoid = new Set<number>() }: RecommendOptions = {},
): Recommendation {
  const status = draftStatus(settings, picks);
  const avail = evaluation.list.filter((e) => !e.taken);
  const empty: Recommendation = {
    status,
    picks: [],
    chance: null,
    targets: [],
    goners: [],
    between: null,
    reachById: new Map(),
  };
  if (!avail.length || status.nextMine == null) return empty;

  const market = marketOrder(avail, settings.market);
  const mIdx = new Map(market.map((e, i): [number, number] => [e.id, i]));
  const beforeMine = status.nextMine - status.current; // others picking before my turn
  const between = status.afterThat == null ? null : status.afterThat - status.nextMine - 1;

  // Each player's place on the full list, and picks the pool has made since it came up
  const placeOf = (e: Entry) => (e.marketRank ?? 61) - 1;
  const passed = (e: Entry) => Math.max(0, status.current - placeOf(e));
  const odds = (e: Entry, m: number, n: number) => survival(m, n, passed(e), placeOf(e));
  // Chance each player is still there when my upcoming pick comes (1 if I'm on the clock)
  const reach = (e: Entry) => odds(e, mIdx.get(e.id)!, beforeMine);

  // The rest of the pool can still take players I'm avoiding; I just won't be told to.
  const wanted = avail.filter((e) => !avoid.has(e.id));
  if (!wanted.length) return empty;
  const cands = wanted.slice(0, depth);
  const scored = cands.slice(0, pool).map((x): ScoredPick => {
    const mx = mIdx.get(x.id)!;
    let nextEV = 0;
    if (between != null) {
      let pNone = 1;
      for (const c of cands) {
        if (c.id === x.id) continue;
        const m = mIdx.get(c.id)! - (mx < mIdx.get(c.id)! ? 1 : 0);
        // Must be there for my upcoming pick and then survive until the one after
        const pc = odds(c, m, beforeMine + between);
        nextEV += pNone * pc * c.score;
        pNone *= 1 - pc;
        if (pNone < 1e-4) break;
      }
      nextEV += pNone * (cands[cands.length - 1]?.score ?? 0) * 0.95;
    }
    return {
      e: x,
      ev: x.score + nextEV,
      nextEV,
      reach: reach(x),
      lastsToNext: between == null ? 0 : odds(x, mx, beforeMine + between),
    };
  });

  const ranked = scored.sort((a, b) => b.ev - a.ev);
  // Not on the clock yet: a ladder of who to take, best first, skipping anyone with little
  // chance of being there (Plan A, then who to take if he's gone, and so on).
  const shortlist = status.myTurn ? ranked : ranked.filter((r) => r.reach >= 0.15);

  const best: RecPick[] = shortlist.slice(0, top).map((r, i) => ({
    ...r,
    reasons: reasonsFor(r, ranked, i, status, between, evaluation),
  }));

  // Last rounds: a take-a-chance pick. The high-upside player (young, new to the NHL or often
  // hurt) with the most value once a bust can be swapped out at the All-Star break, as long as
  // his good season beats what the redraft would give.
  let chance: ChancePick | null = null;
  const drops = settings.redraftDrops ?? 0;
  const myIdx = status.mine.indexOf(status.nextMine);
  const level = evaluation.redraftLevel;
  if (drops > 0 && myIdx >= settings.rounds - drops && level > 0) {
    const shown = new Set(best.map((r) => r.e.id));
    const pick = wanted
      .filter(
        (e) =>
          !shown.has(e.id) &&
          e.p.upside >= 0.28 &&
          e.ceiling > level &&
          (status.myTurn || reach(e) >= 0.15),
      )
      .map((e) => ({ e, v: insuredValue(e, level) }))
      .sort((a, b) => b.v - a.v)[0];
    if (pick) {
      const e = pick.e;
      const mx = mIdx.get(e.id)!;
      const r = {
        e,
        reach: reach(e),
        lastsToNext: between == null ? 0 : odds(e, mx, beforeMine + between),
      };
      const reasons = reasonsFor(r, ranked, -1, status, between, evaluation);
      reasons.splice(
        1,
        0,
        `Take a chance: in a good year (about 1 in 5) he scores ~${Math.round(e.ceiling)}, more than the ~${Math.round(level)} a redraft pickup is likely to give. If he busts, he's one of the ${drops} you swap out at the All-Star break`,
      );
      chance = { ...r, reasons };
    }
  }

  // Who is likely to be there at my pick (useful while waiting)
  const targets = wanted
    .slice(0, 60)
    .map((e) => ({ e, reach: reach(e) }))
    .filter((t) => t.reach >= 0.5)
    .slice(0, 10);
  const goners = wanted
    .slice(0, 25)
    .map((e) => ({ e, reach: reach(e) }))
    .filter((t) => t.reach < 0.5)
    .slice(0, 8);

  // For the board: chance each player is there at my upcoming pick, and (on the clock) at the next
  const reachById = new Map(
    avail.map((e): [number, number | null] => [
      e.id,
      status.myTurn
        ? between == null
          ? null
          : odds(e, mIdx.get(e.id)!, between)
        : odds(e, mIdx.get(e.id)!, beforeMine),
    ]),
  );
  return { status, picks: best, chance, targets, goners, between, reachById };
}

// A chance as a whole percent, never a sure thing either way
export const pctOf = (x: number): number => Math.max(1, Math.min(99, Math.round(x * 100)));

function reasonsFor(
  r: { e: Entry; reach: number; lastsToNext: number },
  ranked: ScoredPick[],
  i: number,
  status: DraftStatus,
  between: number | null,
  evaluation: Evaluation,
): string[] {
  const e = r.e;
  const out: string[] = [];
  const src =
    e.espn != null && !e.speculative
      ? ` (ESPN ${Math.round(e.espn)} · model ${Math.round(e.own)})`
      : e.speculative
        ? " (rough prospect estimate)"
        : "";
  out.push(`Projects ${Math.round(e.proj)} pts${src} over ~${e.expGP} games`);
  // The odds come second so they stay in view on the alternatives, which show four lines
  if (between != null && status.myTurn) {
    const pct = pctOf(r.lastsToNext);
    const next = `#${status.afterThat! + 1}`;
    if (pct <= 30) out.push(`Only ~${pct}% chance he lasts to your next pick (${next})`);
    else if (pct >= 70 && i === 0)
      out.push(
        `~${pct}% chance he's still there at ${next}, and nobody near the top of your board is at risk, so take the best score`,
      );
    else if (pct >= 70)
      out.push(`~${pct}% chance he's still there at ${next}: a target for next time`);
    else if (pct <= 44) out.push(`Less than even (${pct}%) that he lasts to ${next}`);
    else if (pct >= 56) out.push(`Better than even (${pct}%) that he lasts to ${next}`);
    else out.push(`About a coin flip (${pct}%) whether he lasts to ${next}`);
  } else if (!status.myTurn) {
    out.push(`~${pctOf(r.reach)}% chance he's still there at your pick (#${status.nextMine! + 1})`);
  }
  // If a higher-scoring player was passed over, say why
  if (i === 0 && status.myTurn) {
    const higher = ranked
      .filter((x) => x.e.score > e.score + 0.05)
      .sort((a, b) => b.e.score - a.e.score)[0];
    if (higher && higher.lastsToNext >= 0.5)
      out.push(
        `${higher.e.p.name} scores a bit higher (${Math.round(higher.e.score)}) but has ~${Math.round(higher.lastsToNext * 100)}% odds of lasting to #${status.afterThat! + 1}; take ${e.p.name.split(" ").slice(-1)[0]} now`,
      );
  }
  if (e.p.lastRow) {
    const h = e.p.lastRow;
    out.push(`Last season: ${h.pts} pts in ${h.gp} GP`);
  }
  const recent = recentLine(e.p);
  if (recent) out.push(e.p.slumped ? `${recent}, a bounce-back candidate` : recent);
  for (const t of e.tags) {
    if (t.k === "bounce" && e.p.slumped) continue; // already said on the points-per-game line
    if (
      [
        "stack",
        "bounce",
        "rising",
        "declining",
        "rookie",
        "offense",
        "contract",
        "injury",
      ].includes(t.k)
    )
      out.push(t.short || t.d);
  }
  return out;
}

// ---------- mock drafts ----------

// One computer-drafted pick. `ordered` is the pool in the order this team values players (a
// marketOrder list, computed once per mock since it doesn't change as players go). The team
// usually takes one of the next few, and sometimes reaches; a higher `noise` spreads it out.
export function cpuPick(
  ordered: readonly { id: number }[],
  takenIds: ReadonlySet<number>,
  noise = 1,
  rng: () => number = Math.random,
): number | null {
  const next: number[] = [];
  for (const e of ordered) {
    if (takenIds.has(e.id)) continue;
    next.push(e.id);
    if (next.length === 8) break;
  }
  if (!next.length) return null;
  const weights = next.map((_, i) => Math.exp(-i / (0.9 * noise)));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < next.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return next[i]!;
  }
  return next[next.length - 1]!;
}

// How the pool's own drafts stray from any list, for mock computer teams. The whole room rates
// each player a bit above or below his place on the list, and below the top 25 or so there's a
// growing chance it all but ignores him (hurt, or just not rated); stars never slide far. Each
// team adds its own view on top. Tuned so mocks follow the "pool" list about as closely as the
// pool's 2022-23 to 2025-26 drafts did, leave out as many players at each depth, and players
// last about as often.
const ROOM = { spread: 0.4, team: 0.3, skip: 0.3, skipFrom: 25, skipRamp: 80, skipBy: 1.5 };
// The pool's habits beyond the list, from a model of each of those 640 picks (in the list's
// units): players 32 and older go later than the list says, under-24s a little earlier,
// defencemen a touch later, and players whose projection ranks them well above last season's
// points (rookies, bounce-backs) a little later. A team's `lean` (data/pool-teams.json) nudges
// these for that team.
const HABITS = { list: 1.46, projLean: -0.1, D: -0.06, young: 0.13, vet: -0.31 };

// Seeded random numbers, so a mock's computer teams keep the same views after a reload
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function gauss(rng: () => number): number {
  let u = 0;
  while (!u) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// Each computer team's board, best first. `orders` maps a style to its marketOrder list (with
// "pool", "points" and "proj" among them) and `cpu` maps a slot to { style, noise, lean }; a
// higher noise means a team with more opinions of its own.
export function cpuBoards(
  orders: MarketOrders,
  cpu: Readonly<Record<string, CpuTeam>>,
  rng: () => number = Math.random,
): CpuBoards {
  const base: readonly Entry[] = orders.pool || Object.values(orders)[0] || [];
  const rankIn = (list: readonly Entry[] | undefined) =>
    new Map((list || base).map((e, i): [number, number] => [e.id, i + 1]));
  const placeOf = rankIn(base);
  const ptsRank = rankIn(orders.points);
  const projRank = rankIn(orders.proj);
  const traits = (e: Entry) => {
    const age = e.p.age ?? 28;
    const lean = Math.log(ptsRank.get(e.id) ?? 999) - Math.log(projRank.get(e.id) ?? 999);
    return {
      projLean: Math.max(-3, Math.min(3, lean)),
      D: e.p.pos === "D" ? 1 : 0,
      young: age < 24 ? 1 : 0,
      vet: age >= 32 ? 1 : 0,
    };
  };
  const room = new Map<number, number>();
  for (const e of [...base].sort((a, b) => a.id - b.id)) {
    const r = placeOf.get(e.id)!;
    const skip = ROOM.skip * Math.min(1, Math.max(0, (r - ROOM.skipFrom) / ROOM.skipRamp));
    room.set(e.id, ROOM.spread * gauss(rng) + (rng() < skip ? ROOM.skipBy : 0));
  }
  const boards: CpuBoards = {};
  for (const slot of Object.keys(cpu).sort((a, b) => Number(a) - Number(b))) {
    const { style, noise = 1, lean = {} } = cpu[slot]!;
    const order = orders[style] || base;
    // A team that sticks to the list more than most has fewer opinions of its own
    const own = (ROOM.team * noise * HABITS.list) / (HABITS.list + (lean.list ?? 0));
    const top = order.slice(0, 400).map((e, i) => {
      const t = traits(e);
      let habit = 0;
      for (const k of ["projLean", "D", "young", "vet"] as const)
        habit += (HABITS[k] + (lean[k] ?? 0)) * t[k];
      return {
        e,
        v: Math.log(i + 1) + (room.get(e.id) ?? 0) + own * gauss(rng) - habit / HABITS.list,
      };
    });
    top.sort((a, b) => a.v - b.v);
    boards[slot] = [...top.map((x) => x.e), ...order.slice(400)];
  }
  return boards;
}

// Projected points for every team's roster, best first.
export function teamTotals(
  evaluation: Evaluation,
  settings: Settings,
  picks: readonly DraftPick[],
): TeamTotal[] {
  const teams = new Map<number, TeamTotal>();
  for (let slot = 1; slot <= settings.teams; slot++)
    teams.set(slot, { slot, total: 0, players: [] });
  picks.forEach((pick, i) => {
    const t = teams.get(slotForPick(i, settings.teams));
    const e = pick.id != null ? evaluation.byId.get(pick.id) : null;
    if (!t || !e) return;
    t.total += e.proj;
    t.players.push({ e, pick: i });
  });
  return [...teams.values()].sort((a, b) => b.total - a.total);
}

export { fmtSeason, STACK_SHARE };
