// The recap at the top of the Standings page: a short announcer-style rundown of the last synced
// game day, written from the season data (who won the night, the pool's best line, the lead, who
// moved, who got blanked). The wording rotates with the date, so it reads fresh each morning but is
// the same for everyone that day. Pure, tested in brief.test.ts.
import { ord } from "./history";
import type { SeasonData } from "./season";

// Team and player names come back as their own parts so the page can link and bold them
export type BriefPart = string | { team: string } | { player: string };
export type BriefLine = BriefPart[];
// An opening shout ("Hats on the ice!") for a big night, then a few sentences
export type Brief = { shout: string | null; lines: BriefLine[] };

export const briefText = (line: BriefLine) =>
  line.map((p) => (typeof p === "string" ? p : "team" in p ? p.team : p.player)).join("");

type Team = SeasonData["teams"][number];
type Scorer = SeasonData["lastNight"][number];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pts = (n: number) => plural(n, "point");
const nightPts = (s: Scorer | undefined) => (s ? s.lastNight!.g + s.lastNight!.a : 0);

// A player's night the way an announcer says it: "a hat trick and 2 assists"
export function statLine(g: number, a: number) {
  const goals = g === 0 ? "" : g === 1 ? "a goal" : g === 3 ? "a hat trick" : `${g} goals`;
  const assists = a === 0 ? "" : a === 1 ? "an assist" : `${a} assists`;
  return goals && assists ? `${goals} and ${assists}` : goals || assists;
}
const stat = (s: Scorer) => statLine(s.lastNight!.g, s.lastNight!.a);

// "A", "A and B", "A, B and C"
function names(teams: Team[]): BriefPart[] {
  return teams.flatMap((t, i) => [
    ...(i === 0 ? [] : [i === teams.length - 1 ? " and " : ", "]),
    { team: t.name },
  ]);
}

// Groups this big read better as a count than a list of names
const MAX_NAMES = 4;

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function nightBrief(data: Pick<SeasonData, "teams" | "lastNight" | "lastDate">): Brief {
  const { teams, lastNight: scorers } = data;
  const top = Math.max(0, ...teams.map((t) => t.lastNight));
  if (top === 0) return { shout: null, lines: [] };
  // The same choice all day for everyone, a different one the next game day
  const pick = <T>(key: string, options: T[]) =>
    options[hash(`${data.lastDate}|${key}`) % options.length]!;
  const place = (rank: number) =>
    (teams.filter((t) => t.rank === rank).length > 1 ? "T-" : "") + ord(rank);
  const lines: BriefLine[] = [];
  const mentioned: Scorer[] = [];

  // Who won the night, and the player who carried them
  const winners = teams.filter((t) => t.lastNight === top);
  if (winners.length === 1) {
    const w = { team: winners[0]!.name };
    const best = scorers.find((s) => s.ownerSlot === winners[0]!.slot);
    if (!best) lines.push([w, ` won the night with ${pts(top)}.`]);
    else {
      mentioned.push(best);
      const p = { player: best.name };
      lines.push(
        nightPts(best) === top
          ? pick("win", [
              [
                p,
                " single-handedly carried ",
                w,
                `: ${stat(best)}, ${pts(top)} and the best night in the pool.`,
              ],
              [
                w,
                " rode ",
                p,
                ` all night long: ${stat(best)} for ${pts(top)}, and nobody in the pool did better.`,
              ],
              [
                p,
                " was the whole show for ",
                w,
                `: ${stat(best)} for ${pts(top)}, tops on the night.`,
              ],
            ])
          : pick("win", [
              [
                w,
                ` won the night with ${pts(top)}, and `,
                p,
                ` led the charge with ${stat(best)}.`,
              ],
              [
                w,
                ` piled up ${pts(top)} to take the night, with `,
                p,
                ` chipping in ${stat(best)}.`,
              ],
              [
                "Nobody had a better night than ",
                w,
                `: ${pts(top)}, led by `,
                p,
                ` with ${stat(best)}.`,
              ],
            ]),
      );
    }
  } else if (winners.length <= MAX_NAMES) {
    lines.push(
      pick("win", [
        [...names(winners), ` split the night's spoils, ${pts(top)} apiece.`],
        ["Dead heat for the night's best: ", ...names(winners), ` with ${pts(top)} each.`],
      ]),
    );
  } else {
    lines.push([`A crowded night at the top: ${winners.length} teams tied with ${pts(top)} each.`]);
  }

  // The pool's best line, when one player is clear on points and wasn't already named above
  const star = scorers[0];
  if (
    star &&
    !mentioned.includes(star) &&
    nightPts(star) >= 2 &&
    nightPts(star) > nightPts(scorers[1])
  ) {
    mentioned.push(star);
    const p = { player: star.name };
    const t = { team: star.owner };
    lines.push(
      pick("star", [
        ["Tip of the cap to ", p, `, who had ${stat(star)} for `, t, "."],
        ["Don't sleep on ", p, `: ${stat(star)} for `, t, "."],
        [t, " will want to frame ", p, `'s night: ${stat(star)}.`],
      ]),
    );
  }

  // The lead
  const leaders = teams.filter((t) => t.rank === 1);
  const tookOver = leaders.length === 1 && leaders[0]!.prevRank != null && leaders[0]!.prevRank > 1;
  if (leaders.length === 1) {
    const l = { team: leaders[0]!.name };
    const nextRank = Math.min(...teams.filter((t) => t.rank > 1).map((t) => t.rank));
    const second = teams.filter((t) => t.rank === nextRank);
    if (second.length > 0) {
      const n = leaders[0]!.pts - second[0]!.pts;
      const s = { team: second[0]!.name };
      if (second.length > 1)
        lines.push(
          tookOver
            ? [l, ` climbs into 1st, ${pts(n)} clear of the pack.`]
            : [l, ` leads the pack by ${pts(n)}.`],
        );
      else if (tookOver)
        lines.push(
          pick("lead", [
            [l, ` climbs into 1st, ${pts(n)} ahead of `, s, "."],
            [l, ` grabs the top spot, ${pts(n)} clear of `, s, "."],
          ]),
        );
      else if (n <= 2)
        lines.push(
          pick("lead", [
            [
              l,
              " leads ",
              s,
              ` by ${n === 1 ? "a single point" : "just 2 points"}, so nobody's popping champagne yet.`,
            ],
            [l, " is on top, but ", s, ` is right on their tail, ${pts(n)} back.`],
          ]),
        );
      else if (n < 10)
        lines.push(
          pick("lead", [
            [l, " leads ", s, ` by ${pts(n)}.`],
            [l, ` sits in 1st, ${pts(n)} up on `, s, "."],
          ]),
        );
      else
        lines.push(
          pick("lead", [
            [l, ` is running away with it, ${pts(n)} clear of `, s, "."],
            [l, ` leads by a country mile: ${pts(n)} over `, s, "."],
          ]),
        );
    }
  } else if (leaders.length <= MAX_NAMES) {
    const at = pts(leaders[0]!.pts);
    lines.push(
      pick("lead", [
        [...names(leaders), ` are deadlocked for 1st at ${at}. Grab the popcorn.`],
        ["Logjam at the top: ", ...names(leaders), ` are tied at ${at}.`],
      ]),
    );
  } else {
    lines.push([`${leaders.length} teams share 1st at ${pts(leaders[0]!.pts)}. Anybody's pool.`]);
  }

  // Biggest climb and biggest slide since the game day before (none after the first game day).
  // A team that took over 1st was already mentioned.
  const moved = teams
    .filter((t) => t.prevRank != null && !(tookOver && t.rank === 1))
    .map((t) => ({ t, by: t.prevRank! - t.rank }));
  const climb = moved.filter((m) => m.by > 0).sort((a, b) => b.by - a.by || a.t.rank - b.t.rank)[0];
  const slide = moved
    .filter((m) => m.by < 0)
    .sort((a, b) => a.by - b.by || a.t.prevRank! - b.t.prevRank!)[0];
  if (climb) {
    const t = { team: climb.t.name };
    const how = `${plural(climb.by, "spot")} to ${place(climb.t.rank)}`;
    lines.push(
      pick("climb", [
        [t, ` is on the move, up ${how}.`],
        ["Big jump for ", t, `: up ${how}.`],
      ]),
    );
  }
  if (slide) {
    const t = { team: slide.t.name };
    const how = `${plural(-slide.by, "spot")} to ${place(slide.t.rank)}`;
    lines.push(
      pick("slide", [
        ["Rough night for ", t, `, down ${how}.`],
        [t, ` slipped ${how}.`],
      ]),
    );
  }

  // Teams that had players in action and still got nothing
  const shutOut = teams.filter((t) => t.lastNight === 0 && t.roster.some((p) => p.lastNight));
  if (shutOut.length > MAX_NAMES)
    lines.push([
      `${shutOut.length} teams got blanked. The goalies must be sending thank-you cards.`,
    ]);
  else if (shutOut.length)
    lines.push(
      pick("blank", [
        [...names(shutOut), " came up empty. Shake it off, there's always tomorrow."],
        ["Nothing doing for ", ...names(shutOut), ". The goalies send their regards."],
        [...names(shutOut), " got blanked. Somebody check the Zamboni for their scoring touch."],
      ]),
    );

  // A big night gets a shout: a hat trick from someone named above, or a new leader
  const shout = mentioned.some((s) => s.lastNight!.g >= 3)
    ? pick("shout", ["Hats on the ice!", "Hat trick alert!", "Throw your caps, folks!"])
    : tookOver
      ? pick("shout", ["Changing of the guard!", "We have a new leader!", "Stop the presses!"])
      : null;

  return { shout, lines };
}
