// Who's hurt right now: ESPN's public injury report matched to the pool's players. Pure, tested in
// injuries.test.ts; the fetch is in injuries.server.ts.
//
// ESPN has no NHL player ids, so a player is matched by name, then by NHL team and position when a
// name isn't enough. Names differ between the two ("John-Jason Peterka" is "JJ Peterka", "Mats
// Zuccarello Aasen" is "Mats Zuccarello", accents come and go), and when a match isn't certain the
// player simply shows no injury.

export type InjuryKind = "ir" | "out" | "dtd" | "susp";
export type Injury = {
  kind: InjuryKind;
  label: string; // the badge: "IR", "OUT", "DTD", "SUSP"
  status: string; // ESPN's words: "Injured Reserve"
  detail: string | null; // "Upper Body"
  returnDate: string | null; // ESPN's estimate, YYYY-MM-DD
  note: string | null;
};

// One line of ESPN's report
export type ReportLine = {
  name: string;
  first: string;
  last: string;
  team: string | null; // ESPN's team code
  pos: string | null; // C, LW, RW, D, G
  status: string;
  detail: string | null;
  returnDate: string | null;
  note: string | null;
};

type Player = { id: number; name: string; team: string | null; pos: string | null };
type Day = { date: string; games: { state: string; away: string; home: string }[] };

// About 3 games a week: an 84-game season over about 195 days. For return dates past the week's
// schedule, where the games can't be counted.
export const GAMES_PER_DAY = 84 / 195;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const dayAfter = (date: string) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// How many of his NHL team's games a player is expected to miss before ESPN's return date: the
// ones in the week's schedule counted, the rest estimated at the league's pace. Nothing without
// a return date, since there's nothing to go on.
export function gamesOut(
  injury: Injury | null | undefined,
  team: string | null,
  schedule: Day[],
  today: string,
): number {
  const back = injury?.returnDate;
  if (!back || !team || back <= today) return 0;
  let counted = 0;
  for (const d of schedule) {
    if (d.date < today || d.date >= back) continue;
    for (const g of d.games)
      // A game already over is in his team's games played, not its games left
      if ((g.away === team || g.home === team) && g.state !== "OFF" && g.state !== "FINAL")
        counted++;
  }
  const lastScheduled = schedule.reduce((max, d) => (d.date > max ? d.date : max), "");
  const from = lastScheduled >= today ? dayAfter(lastScheduled) : today;
  const beyond = back > from ? daysBetween(from, back) * GAMES_PER_DAY : 0;
  return Math.round(counted + beyond);
}

const LABEL: Record<InjuryKind, string> = { ir: "IR", out: "OUT", dtd: "DTD", susp: "SUSP" };

// ESPN's team codes that differ from NHL.com's
const ESPN_TEAM: Record<string, string> = { LA: "LAK", NJ: "NJD", SJ: "SJS", TB: "TBL" };
export const nhlTeam = (espn: string | null) => (espn ? (ESPN_TEAM[espn] ?? espn) : null);

// "Tim Stützle" and "J.T. Miller" as "timstutzle" and "jtmiller"
export const plainName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

export function kindOf(status: string): InjuryKind {
  const s = status.toLowerCase();
  if (s.includes("reserve")) return "ir";
  if (s.includes("suspen")) return "susp";
  if (s.includes("day")) return "dtd";
  if (s === "out" || s.startsWith("out")) return "out";
  // Questionable, probable and the like: he might play
  return "dtd";
}

// Out of the lineup for sure (injured reserve, out, suspended), as against day-to-day
export const isOut = (i: Injury | null | undefined) => !!i && i.kind !== "dtd";

const group = (pos: string | null) => (pos === "D" ? "D" : pos === "G" ? "G" : "F");

// The same person: a forward or a defenceman like him, on his NHL team. Two players can share a
// name (two Sebastian Ahos, two Elias Petterssons on one team), so the name alone isn't enough; a
// player whose trade the game logs haven't caught up with just shows no injury for a day.
const fits = (p: Player, r: ReportLine) =>
  group(r.pos) === group(p.pos) && (!p.team || nhlTeam(r.team) === p.team);

function candidates(p: Player, report: ReportLine[]) {
  const mine = plainName(p.name);
  const exact = report.filter((r) => plainName(r.name) === mine);
  if (exact.length) return exact.filter((r) => fits(p, r));
  // A nickname or a shortened name: ESPN's last name somewhere in ours, and the same first initial
  return report.filter((r) => {
    const last = plainName(r.last);
    return (
      !!p.team &&
      fits(p, r) &&
      last.length > 2 &&
      mine.includes(last) &&
      plainName(r.first)[0] === mine[0]
    );
  });
}

export function matchInjuries(players: Player[], report: ReportLine[]): Record<number, Injury> {
  const picked = new Map<number, ReportLine>();
  const claimed = new Map<ReportLine, number>();
  for (const p of players) {
    const c = candidates(p, report);
    if (c.length !== 1) continue;
    picked.set(p.id, c[0]!);
    claimed.set(c[0]!, (claimed.get(c[0]!) ?? 0) + 1);
  }
  const out: Record<number, Injury> = {};
  for (const [id, line] of picked) {
    // A report line is one person: if two of ours fit it, we can't tell which
    if (claimed.get(line) !== 1) continue;
    const kind = kindOf(line.status);
    out[id] = {
      kind,
      label: LABEL[kind],
      status: line.status,
      detail: line.detail,
      returnDate: line.returnDate,
      note: line.note,
    };
  }
  return out;
}
