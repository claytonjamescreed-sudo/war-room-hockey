// The recap at the top of the Standings page: a short announcer-style rundown of the last synced
// game day, written from the season data (who won the night, the pool's best line, the lead, who
// moved, who got blanked). Pure, tested in brief.test.ts.
//
// Each game day is called from one of five Vancouver booths in turn (src/data/booths.ts): John
// Shorthouse, John Garrett, Jim Robson, Don Taylor and Tom Larscheid. A booth brings its opening,
// sign-off, shouts and a saying of the day, now and then a line of its own for the night, and one
// segment the others don't do (three stars, the injury ward, the week's hottest or coldest team).
//
// Nothing repeats until it has to: every list is gone through in turn (nth), the booth's lists
// once per time it calls a game day and the house wording once per game day, so a line comes back
// only after the rest of its list has been used. The same day always reads the same for everyone.
import { BOOTHS, type BoothId, type Shout } from "../data/booths";
import { isOut } from "./injuries";
import { ord } from "./history";
import type { SeasonData } from "./season";

export { BOOTHS, type BoothId };

// Team and player names come back as their own parts so the page can link and bold them
export type BriefPart = string | { team: string } | { player: string };
export type BriefLine = BriefPart[];

const ROTATION: BoothId[] = ["shorty", "cheech", "robson", "taylor", "tommy"];

export const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
// One booth a day, in turn, so the next game day always has a different one
export const boothFor = (date: string) => ROTATION[dayNumber(date) % ROTATION.length]!;

// The booth's greeting, an opening shout ("Hats on the ice!") for a big night, the rundown, the
// booth's saying of the day and its sign-off
export type Brief = {
  booth: BoothId | null;
  open: BriefLine | null;
  shout: string | null;
  lines: BriefLine[];
  saying: string | null;
  signoff: BriefLine | null;
};
const NOTHING: Brief = {
  booth: null,
  open: null,
  shout: null,
  lines: [],
  saying: null,
  signoff: null,
};

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
const scored = (s: Scorer) => s.lastNight!.g > 0;

// "A", "A and B", "A, B and C"
function names(teams: Team[]): BriefPart[] {
  return teams.flatMap((t, i) => [
    ...(i === 0 ? [] : [i === teams.length - 1 ? " and " : ", "]),
    { team: t.name },
  ]);
}

// Groups this big read better as a count than a list of names
const MAX_NAMES = 4;

// "a 5-point lead", "an 8-point lead", "an 11-point lead", "an 80-point lead"
export const aPointLead = (n: number) =>
  `${n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89) || (n >= 800 && n <= 899) ? "an" : "a"} ${n}-point lead`;

// A booth's running jokes: one recap tells each at most once
const MOTIFS = [
  "moustache",
  "peanut butter",
  "mesh",
  "scintillating",
  "rapier",
  "ketchup",
  "half full",
  "hot dog",
  "fries",
  "plate",
  "dragon",
  "lets it go",
  "fire",
  "effort",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

// The k-th item of a list, going through it in a scattered order (a step that shares no factor
// with the list's length, from a start of its own for each key): k, k+1, … k+length-1 give every
// item exactly once, so nothing repeats until the whole list has been used
export function nth<T>(list: T[], k: number, key: string): T {
  const n = list.length;
  let step = 1 + (hash(key) % Math.max(1, n - 1));
  while (gcd(step, n) !== 1) step++;
  return list[(hash(`${key}#`) + k * step) % n]!;
}

export function nightBrief(data: Pick<SeasonData, "teams" | "lastNight" | "lastDate">): Brief {
  const { teams, lastNight: scorers, lastDate } = data;
  const top = Math.max(0, ...teams.map((t) => t.lastNight));
  if (top === 0 || !lastDate) return NOTHING;
  const day = dayNumber(lastDate);
  const booth = boothFor(lastDate);
  // How many game days this booth has called before: its lists go round once per call
  const turn = Math.floor(day / ROTATION.length);
  const bank = BOOTHS[booth];
  const fromBooth = <T>(key: string, list: T[]) => nth(list, turn, `${booth}|${key}`);
  // The house wording for the night's numbers: a different one each game day
  const house = <T>(key: string, options: T[]) => nth(options, day, key);
  // The booth's saying of the day, chosen first so nothing else today tells the same joke
  const saying = fromBooth("saying", bank.sayings);
  const open = fromBooth("open", bank.open);
  const signoff = fromBooth("signoff", bank.signoff);
  const shared = (a: string, b: string) =>
    MOTIFS.some((m) => a.toLowerCase().includes(m) && b.toLowerCase().includes(m));
  const repeats = (text: string) => shared(`${open} ${saying} ${signoff}`, text);
  // The booth's next line from a list, or the one after it if that one tells today's joke again
  const freshFromBooth = (key: string, list: BriefLine[]) =>
    list
      .map((_, i) => nth(list, turn + i, `${booth}|${key}`))
      .find((l) => !repeats(briefText(l))) ?? fromBooth(key, list);
  // A line of the booth's own one turn in three, going round its own list; the house wording
  // otherwise, so a booth's line for a moment doesn't come back every time it calls
  const flavour = (
    key: string,
    own: Partial<Record<BoothId, BriefLine[]>>,
    options: BriefLine[],
  ) => {
    const mine = own[booth];
    const line =
      mine?.length && (turn + hash(key)) % 3 === 0
        ? nth(mine, Math.floor(turn / 3), `${booth}|${key}`)
        : null;
    return line && !repeats(briefText(line)) ? line : house(key, options);
  };
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
      const s = stat(best);
      const n = pts(top);
      lines.push(
        nightPts(best) === top
          ? flavour(
              "carried",
              {
                shorty: scored(best)
                  ? [
                      [
                        p,
                        " lets it go, he scores! ",
                        w,
                        ` rides ${s} to ${n}, the best night in the pool.`,
                      ],
                    ]
                  : [],
                cheech: [
                  [
                    p,
                    " was the whole meal for ",
                    w,
                    `: ${s}, ${n}, and nobody in the pool ate better.`,
                  ],
                ],
                taylor: scored(best)
                  ? [
                      [
                        "The mesh ripples for ",
                        p,
                        `: ${s}, carrying `,
                        w,
                        ` to ${n}, tops in the pool.`,
                      ],
                    ]
                  : [],
                tommy: [
                  [p, " showed up for ", w, `: ${s}, ${n}, the best night in the pool. I love it!`],
                ],
              },
              [
                [p, " carried ", w, ` with ${s}: ${n} and the best night in the pool.`],
                [w, " rode ", p, ` all night: ${s} for ${n}, tops in the pool.`],
                [p, " was the whole show for ", w, `: ${s}, ${n}.`],
                ["The night belonged to ", w, ", thanks to ", p, `: ${s} for ${n}.`],
                [p, " did it all for ", w, `: ${s}, ${n}, best in the pool.`],
                ["One-man show: ", p, ` had ${s}, and `, w, ` won the night with ${n}.`],
                [p, " put ", w, ` on his back: ${s} and ${n}, the best night in the pool.`],
                ["Best in the pool: ", w, ` with ${n}, courtesy of `, p, `: ${s}.`],
                [w, " won the night on the back of ", p, `: ${s} for ${n}.`],
                ["What a night for ", p, `: ${s}, carrying `, w, ` to ${n}, best in the pool.`],
              ],
            )
          : flavour(
              "won",
              {
                cheech: [
                  [w, ` cleaned their plate: ${n} to win the night, with `, p, ` serving up ${s}.`],
                ],
                taylor: scored(best)
                  ? [[w, ` won the night with ${n}, and the mesh rippled for `, p, `: ${s}.`]]
                  : [],
              },
              [
                [w, ` won the night with ${n}, and `, p, ` led the charge with ${s}.`],
                [w, ` piled up ${n} to take the night, with `, p, ` chipping in ${s}.`],
                ["Nobody had a better night than ", w, `: ${n}, led by `, p, ` with ${s}.`],
                [w, ` topped the pool with ${n}. `, p, ` did the most damage: ${s}.`],
                ["The best night in the pool went to ", w, `: ${n}, with ${s} from `, p, "."],
                [w, ` cashed in for ${n}, and `, p, ` was the headliner with ${s}.`],
                [w, ` had the hot hand: ${n}, with `, p, ` leading the way with ${s}.`],
                ["Top of the night: ", w, ` with ${n}. `, p, ` had ${s}.`],
                [w, ` won the night with ${n}, paced by `, p, `: ${s}.`],
                [p, ` had ${s} as `, w, ` won the night with ${n}.`],
                [w, ` had the pool's best night, ${n}, with `, p, ` leading the way: ${s}.`],
              ],
            ),
      );
    }
  } else if (winners.length <= MAX_NAMES) {
    const n = pts(top);
    lines.push(
      flavour("shared", { cheech: [[...names(winners), ` shared the plate, ${n} apiece.`]] }, [
        [...names(winners), ` split the night's spoils, ${n} apiece.`],
        ["Dead heat for the night's best: ", ...names(winners), ` with ${n} each.`],
        [...names(winners), ` shared the night, ${n} each.`],
        ["No clear winner last night: ", ...names(winners), ` each had ${n}.`],
        [...names(winners), ` tied for the night's best with ${n}.`],
        ["A share of the night for ", ...names(winners), `: ${n} each.`],
      ]),
    );
  } else {
    lines.push(
      house<BriefLine>("crowd", [
        [`A crowded night at the top: ${winners.length} teams tied with ${pts(top)} each.`],
        [`${winners.length} teams shared the night's best, ${pts(top)} apiece.`],
        [`No clear winner last night: ${winners.length} teams had ${pts(top)} each.`],
      ]),
    );
  }

  // The night's best players: the booth's own segment if it has one that fits, otherwise the
  // pool's best line when one player is clear on points and wasn't already named above
  const dayToDay = booth === "robson" ? scorers.find((s) => s.injury?.kind === "dtd") : undefined;
  const threeStars = (booth === "shorty" || booth === "robson") && !dayToDay && scorers.length >= 3;
  const star = scorers[0];
  if (dayToDay) {
    mentioned.push(dayToDay);
    lines.push([
      { player: dayToDay.name },
      ` is day-to-day on the injury report and still had ${stat(dayToDay)} for `,
      { team: dayToDay.owner },
      ". He will play, you know he will play!",
    ]);
  } else if (threeStars) {
    const [first, second, third] = scorers as [Scorer, Scorer, Scorer];
    mentioned.push(first, second, third);
    const [p1, p2, p3] = [first, second, third].map((s) => ({ player: s.name }));
    const [s1, s2, s3] = [first, second, third].map(stat);
    lines.push(
      fromBooth<BriefLine>("stars", [
        [
          "Three stars: number three, ",
          p3!,
          `, ${s3}; number two, `,
          p2!,
          `, ${s2}; and the first star, `,
          p1!,
          `, ${s1}.`,
        ],
        ["Last night's three stars: ", p1!, ` (${s1}), `, p2!, ` (${s2}) and `, p3!, ` (${s3}).`],
        ["The three stars: third, ", p3!, "; second, ", p2!, "; and first, ", p1!, `, with ${s1}.`],
        [
          "Your three stars: ",
          p3!,
          `, ${s3}; `,
          p2!,
          `, ${s2}; and the first star, `,
          p1!,
          `, ${s1}.`,
        ],
        ["And the three stars of the night: ", p1!, ", ", p2!, " and ", p3!, "."],
      ]),
    );
  } else if (
    star &&
    !mentioned.includes(star) &&
    nightPts(star) >= 2 &&
    nightPts(star) > nightPts(scorers[1])
  ) {
    mentioned.push(star);
    const p = { player: star.name };
    const t = { team: star.owner };
    const s = stat(star);
    lines.push(
      flavour(
        "star",
        {
          cheech: [["Tip of the cap and a side of fries to ", p, `: ${s} for `, t, "."]],
          taylor: scored(star)
            ? [[p, " went top shelf, where Grandma keeps the peanut butter: ", `${s} for `, t, "."]]
            : [],
        },
        [
          ["Tip of the cap to ", p, `, who had ${s} for `, t, "."],
          ["Don't sleep on ", p, `: ${s} for `, t, "."],
          [t, " will want to frame ", p, `'s night: ${s}.`],
          ["Honourable mention: ", p, ` with ${s} for `, t, "."],
          [p, ` chipped in ${s} for `, t, "."],
          ["Also worth a mention: ", p, `, ${s} for `, t, "."],
          ["Big line for ", p, `: ${s}, all for `, t, "."],
          ["The pool's best line belonged to ", p, `: ${s} for `, t, "."],
        ],
      ),
    );
  }

  // The lead after last night. The standings lines are told as last night's result ("climbed to
  // 3rd", "led by 4"): the standings below move with tonight's games, and keep last night's
  // points overnight until the morning update, so the recap mustn't read as where things stand now.
  const leaders = teams.filter((t) => t.rank === 1);
  const tookOver = leaders.length === 1 && leaders[0]!.prevRank != null && leaders[0]!.prevRank > 1;
  if (leaders.length === 1) {
    const l = { team: leaders[0]!.name };
    const nextRank = Math.min(...teams.filter((t) => t.rank > 1).map((t) => t.rank));
    const second = teams.filter((t) => t.rank === nextRank);
    if (second.length > 0) {
      const gap = leaders[0]!.pts - second[0]!.pts;
      const n = pts(gap);
      const s = { team: second[0]!.name };
      if (second.length > 1)
        lines.push(
          tookOver
            ? house<BriefLine>("over-pack", [
                [l, ` climbed into 1st, ${n} clear of the pack.`],
                [l, ` took over 1st, ${n} clear of the pack.`],
                [l, ` moved to the top, ${n} ahead of the pack.`],
              ])
            : house<BriefLine>("pack", [
                [l, ` led the pack by ${n}.`],
                [l, ` finished the night ${n} clear of a crowd in 2nd.`],
                [l, ` held 1st, ${n} up on a logjam behind.`],
              ]),
        );
      else if (tookOver)
        lines.push(
          house<BriefLine>("over", [
            [l, ` climbed into 1st, ${n} ahead of `, s, "."],
            [l, ` grabbed the top spot, ${n} clear of `, s, "."],
            [l, ` took over 1st, ${n} up on `, s, "."],
            [l, ` moved into 1st, ${n} ahead of `, s, "."],
            [l, ` became the new leader, ${n} clear of `, s, "."],
          ]),
        );
      else if (gap <= 2) {
        const by = gap === 1 ? "a single point" : "just 2 points";
        lines.push(
          flavour(
            "close",
            {
              cheech: [
                [
                  l,
                  " ended the night on top, but ",
                  s,
                  ` got close enough to steal their fries, ${n} back.`,
                ],
              ],
              taylor: [
                [
                  l,
                  ` finished ${by} up on `,
                  s,
                  ". Too close to call, so we'll let Jim Van Horne's moustache decide.",
                ],
              ],
            },
            [
              [l, ` held 1st by ${by} over `, s, ", so nobody's popping champagne yet."],
              [l, " ended the night on top, but ", s, ` was right on their tail, ${n} back.`],
              [l, " led ", s, ` by ${by}.`],
              [l, " held 1st, with ", s, ` just ${n} back.`],
              ["It was tight at the top: ", l, " led ", s, ` by ${by}.`],
              [l, ` clung to 1st, ${n} up on `, s, "."],
              [s, ` finished ${n} behind `, l, " for 1st."],
            ],
          ),
        );
      } else if (gap < 10)
        lines.push(
          house<BriefLine>("lead", [
            [l, " led ", s, ` by ${n}.`],
            [l, ` finished the night in 1st, ${n} up on `, s, "."],
            [l, ` held ${aPointLead(gap)} lead over `, s, "."],
            [l, ` ended the night on top, ${n} ahead of `, s, "."],
            [s, " trailed ", l, ` by ${n}.`],
            [l, ` was in front by ${n}, with `, s, " next."],
          ]),
        );
      else
        lines.push(
          flavour(
            "far",
            {
              cheech: [
                [
                  l,
                  ` ended the night way out in front, ${n} clear of `,
                  s,
                  ". Save them a seat at the head of the table.",
                ],
              ],
            },
            [
              [l, ` was running away with it, ${n} clear of `, s, "."],
              [l, ` led by a country mile: ${n} over `, s, "."],
              [l, ` had daylight: ${n} ahead of `, s, "."],
              [l, ` owned ${aPointLead(gap).replace("lead", "cushion")} over `, s, "."],
              [l, ` sat comfortably on top, ${n} up on `, s, "."],
            ],
          ),
        );
    }
  } else if (leaders.length <= MAX_NAMES) {
    const at = pts(leaders[0]!.pts);
    lines.push(
      flavour(
        "tied",
        {
          taylor: [
            [
              ...names(leaders),
              ` finished tied for 1st at ${at}. We'll let Jim Van Horne's moustache sort it out.`,
            ],
          ],
        },
        [
          [...names(leaders), ` finished the night deadlocked for 1st at ${at}.`],
          ["Logjam at the top: ", ...names(leaders), ` were tied at ${at}.`],
          [...names(leaders), ` shared 1st at ${at}.`],
          ["It was a tie for 1st: ", ...names(leaders), ` at ${at} each.`],
          ["Nobody owned 1st outright: ", ...names(leaders), ` were level at ${at}.`],
        ],
      ),
    );
  } else {
    lines.push([`${leaders.length} teams shared 1st at ${pts(leaders[0]!.pts)}. Anybody's pool.`]);
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
      flavour(
        "climb",
        {
          cheech: [[t, ` got on a roll, up ${how}.`]],
          shorty: [[t, ` was flying, up ${how}.`]],
          tommy: [[t, ` climbed ${how}, and I love it.`]],
        },
        [
          [t, ` was on the move, up ${how}.`],
          ["Big jump for ", t, `: up ${how}.`],
          [t, ` climbed ${how}.`],
          [t, ` jumped ${how}.`],
          [t, ` moved up ${how}.`],
          [t, ` rose ${how}.`],
          ["The biggest climb belonged to ", t, `, up ${how}.`],
          [t, ` made a move, up ${how}.`],
          ["Going up: ", t, `, ${how}.`],
        ],
      ),
    );
  }
  if (slide) {
    const t = { team: slide.t.name };
    const how = `${plural(-slide.by, "spot")} to ${place(slide.t.rank)}`;
    lines.push(
      flavour(
        "slide",
        {
          cheech: [
            [t, ` slipped ${how}, but the cup is half full: there's plenty of hockey left.`],
          ],
          robson: [["Tough sledding for ", t, `, down ${how}.`]],
          tommy: [[t, ` slid ${how}. Not good enough!`]],
        },
        [
          ["Rough night for ", t, `, down ${how}.`],
          [t, ` slipped ${how}.`],
          [t, ` dropped ${how}.`],
          [t, ` fell ${how}.`],
          ["Tough night for ", t, `, down ${how}.`],
          [t, ` slid ${how}.`],
          ["The biggest drop: ", t, `, down ${how}.`],
          [t, ` gave back ground, down ${how}.`],
        ],
      ),
    );
  }

  // The booth's own segment: Garrett keeps an eye on the injury ward, Taylor on the week's
  // hottest team, Larscheid on the coldest, each falling back on another when there's nothing to
  // say
  const ward = teams
    .map((t) => ({ t, out: t.roster.filter((p) => isOut(p.injury)).length }))
    .filter((x) => x.out >= 2)
    .sort((a, b) => b.out - a.out || a.t.rank - b.t.rank)[0];
  const byWeek = [...teams].sort((a, b) => b.last7 - a.last7 || a.rank - b.rank);
  const hottest = byWeek[0];
  const coldest = byWeek[byWeek.length - 1];
  const alone = (t: Team) => teams.filter((x) => x.last7 === t.last7).length === 1;
  // The week's hottest team, when that isn't the leader or last night's winner (both named
  // already) and it's clear of the rest
  const hot =
    hottest &&
    hottest.last7 >= 5 &&
    hottest.rank !== 1 &&
    !winners.includes(hottest) &&
    alone(hottest)
      ? hottest
      : undefined;
  // The week's coldest, when it's on its own and has half the points of the pool's middle team
  // or fewer (a 15-point week isn't cold when everyone else had 25)
  const middle = byWeek[Math.floor(byWeek.length / 2)]?.last7 ?? 0;
  const cold =
    coldest && middle >= 6 && coldest.last7 * 2 <= middle && alone(coldest) ? coldest : undefined;
  const wardLine = (): BriefLine | null => {
    if (!ward) return null;
    const t = { team: ward.t.name };
    const n = ward.out;
    return booth === "cheech"
      ? freshFromBooth("ward", [
          ["The injury ward for ", t, ` is fuller than a buffet line: ${n} players out.`],
          ["Get the soup on for ", t, `: ${n} players out.`],
          ["Chicken soup all round for ", t, `, with ${n} players out.`],
        ])
      : house<BriefLine>("ward", [
          ["Get well soon to ", t, `, with ${n} players out.`],
          [t, ` is playing short with ${n} players out.`],
          ["The infirmary is busy for ", t, `: ${n} players out.`],
        ]);
  };
  const hotLine = (): BriefLine | null =>
    hot
      ? house<BriefLine>("hot", [
          [
            "Hottest team in the pool this week: ",
            { team: hot.name },
            `, ${pts(hot.last7)} over the last 7 days.`,
          ],
          [
            { team: hot.name },
            ` has been on fire: ${pts(hot.last7)} in the last 7 days, best in the pool.`,
          ],
          [
            "Nobody's been hotter over the last week than ",
            { team: hot.name },
            `: ${pts(hot.last7)}.`,
          ],
          ["The week's hottest team: ", { team: hot.name }, `, with ${pts(hot.last7)} in 7 days.`],
        ])
      : null;
  const coldLine = (): BriefLine | null =>
    cold
      ? freshFromBooth("cold", [
          ["Wake-up call for ", { team: cold.name }, `: ${pts(cold.last7)} over the last 7 days.`],
          [
            "Somebody light a fire under ",
            { team: cold.name },
            `: ${pts(cold.last7)} in the last 7 days.`,
          ],
          [{ team: cold.name }, ` has gone quiet: ${pts(cold.last7)} in a week. Not good enough!`],
          ["Effort check for ", { team: cold.name }, `: ${pts(cold.last7)} over the last 7 days.`],
        ])
      : null;
  const extra =
    booth === "cheech"
      ? (wardLine() ?? hotLine())
      : booth === "taylor"
        ? (hotLine() ?? wardLine())
        : booth === "tommy"
          ? (coldLine() ?? hotLine())
          : null;
  if (extra) lines.push(extra);

  // Teams that had players in action and still got nothing
  const shutOut = teams.filter((t) => t.lastNight === 0 && t.roster.some((p) => p.lastNight));
  if (shutOut.length > MAX_NAMES) {
    const n = shutOut.length;
    lines.push(
      flavour(
        "blanks",
        {
          cheech: [[`${n} teams went hungry: not a single point between them.`]],
          taylor: [[`${n} teams ran into some scintillating goaltending and came up empty.`]],
        },
        [
          [`${n} teams got blanked.`],
          [`${n} teams came up empty.`],
          [`${n} teams went pointless.`],
          [`No points at all for ${n} teams.`],
          [`${n} teams were shut out.`],
          [`It was a quiet night for ${n} teams: no points.`],
        ],
      ),
    );
  } else if (shutOut.length)
    lines.push(
      flavour(
        "blank",
        {
          cheech: [
            [
              ...names(shutOut),
              " came up empty. That's a night that needed a little bit of ketchup.",
            ],
          ],
          taylor: [
            [...names(shutOut), " ran into some scintillating goaltending and came up empty."],
          ],
        },
        [
          [...names(shutOut), " came up empty."],
          ["Nothing doing for ", ...names(shutOut), "."],
          [...names(shutOut), " got blanked."],
          [...names(shutOut), " were shut out."],
          [...names(shutOut), " went pointless."],
          ["No points for ", ...names(shutOut), "."],
          ["Zeroes across the board for ", ...names(shutOut), "."],
          [...names(shutOut), " had players dress and nothing to show for it."],
        ],
      ),
    );

  // A big night gets the booth's shout: a hat trick from someone named above, a new leader, or a
  // 4-point night
  const hatTrick = mentioned.find((s) => s.lastNight!.g >= 3);
  const bigNight = mentioned.find((s) => nightPts(s) >= 4);
  // The booth's next shout, or the one after it if that one tells a joke already told today
  // ("Scintillating!" over a line about scintillating goaltending)
  const told = [open, ...lines.map(briefText), saying, signoff].join(" ").toLowerCase();
  const shoutFrom = (key: string, list: Shout[], name: string) => {
    const said = list
      .map((_, i) => nth(list, turn + i, `${booth}|${key}`))
      .map((s) => (typeof s === "string" ? s : s(name)));
    return (
      said.find((s) => !MOTIFS.some((m) => s.toLowerCase().includes(m) && told.includes(m))) ??
      said[0]!
    );
  };
  const shout = hatTrick
    ? shoutFrom("hatTrick", bank.hatTrick, hatTrick.name)
    : tookOver
      ? shoutFrom("newLeader", bank.newLeader, leaders[0]!.name)
      : bigNight
        ? shoutFrom("bigNight", bank.bigNight, bigNight.name)
        : null;

  return {
    booth,
    open: [open],
    shout,
    lines,
    saying,
    signoff: [signoff],
  };
}
