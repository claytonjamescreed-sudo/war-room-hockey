// The recap at the top of the Standings page: a short announcer-style rundown of the last synced
// game day, written from the season data (who won the night, the pool's best line, the lead, who
// moved, who got blanked). Pure, tested in brief.test.ts.
//
// Each game day is called from one of four Vancouver booths in turn, so no two days in a row
// sound alike: John Shorthouse, John Garrett, Jim Robson and Don Taylor. A booth brings its own
// opening, sign-off, shouts and a few lines of its own, and one segment the others don't do
// (three stars, the injury ward, the week's hottest team). The wording within a booth rotates with
// the date, so it's the same for everyone that day.
//
// The booths quote only lines these broadcasters are known for (sourced: Shorthouse's "Lets it go,
// he scores!" and "They've slayed the dragon!"; Robson's hello to the hospital patients and
// shut-ins, his "Greg Adams! Greg Adams!" double call and "He will play, you know he will play!";
// Taylor's "up to date in the world of sports", the top shelf "where Grandma keeps the peanut
// butter", "the mesh ripples", Danny Gallivan's "scintillating" and Jim Van Horne's moustache as
// the judge; Garrett's ketchup, his food talk and his cup-half-full optimism). Everything else is
// our own words in their spirit: never put a new sentence in their mouths as a quote.
import { isOut } from "./injuries";
import { ord } from "./history";
import type { SeasonData } from "./season";

// Team and player names come back as their own parts so the page can link and bold them
export type BriefPart = string | { team: string } | { player: string };
export type BriefLine = BriefPart[];

export type BoothId = "shorty" | "cheech" | "robson" | "taylor";
export const BOOTHS: Record<BoothId, { name: string; nickname: string }> = {
  shorty: { name: "John Shorthouse", nickname: "Shorty" },
  cheech: { name: "John Garrett", nickname: "Cheech" },
  robson: { name: "Jim Robson", nickname: "Robbie" },
  taylor: { name: "Don Taylor", nickname: "The Don" },
};
const ROTATION: BoothId[] = ["shorty", "cheech", "robson", "taylor"];

// One booth a day, in turn, so the next game day always has a different one
export const boothFor = (date: string) =>
  ROTATION[Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000) % ROTATION.length]!;

// The booth's greeting, an opening shout ("Hats on the ice!") for a big night, the rundown, and
// the booth's sign-off
export type Brief = {
  booth: BoothId | null;
  open: BriefLine | null;
  shout: string | null;
  lines: BriefLine[];
  signoff: BriefLine | null;
};
const NOTHING: Brief = { booth: null, open: null, shout: null, lines: [], signoff: null };

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

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function nightBrief(data: Pick<SeasonData, "teams" | "lastNight" | "lastDate">): Brief {
  const { teams, lastNight: scorers, lastDate } = data;
  const top = Math.max(0, ...teams.map((t) => t.lastNight));
  if (top === 0 || !lastDate) return NOTHING;
  const booth = boothFor(lastDate);
  // The same choice all day for everyone, a different one the next game day
  const pick = <T>(key: string, options: T[]) =>
    options[hash(`${lastDate}|${key}`) % options.length]!;
  // The booth's own wording two times in three when it has some, the house wording otherwise
  const call = <T>(key: string, own: Partial<Record<BoothId, T[]>>, house: T[]) => {
    const mine = own[booth] ?? [];
    return mine.length && hash(`${lastDate}|${key}|booth`) % 3 < 2
      ? pick(key, mine)
      : pick(key, house);
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
      lines.push(
        nightPts(best) === top
          ? call<BriefLine>(
              "win",
              {
                shorty: scored(best)
                  ? [
                      [
                        p,
                        " lets it go, he scores! ",
                        w,
                        ` rides ${stat(best)} to ${pts(top)}, the best night in the pool.`,
                      ],
                    ]
                  : [],
                cheech: [
                  [
                    p,
                    " was the whole meal for ",
                    w,
                    `: ${stat(best)}, ${pts(top)}, and nobody in the pool ate better.`,
                  ],
                ],
                robson: [
                  [
                    "What a night for ",
                    p,
                    `: ${stat(best)}, carrying `,
                    w,
                    ` to ${pts(top)}, best in the pool.`,
                  ],
                ],
                taylor: scored(best)
                  ? [
                      [
                        "The mesh ripples for ",
                        p,
                        `: ${stat(best)}, carrying `,
                        w,
                        ` to ${pts(top)}, tops in the pool.`,
                      ],
                    ]
                  : [],
              },
              [
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
              ],
            )
          : call<BriefLine>(
              "win",
              {
                cheech: [
                  [
                    w,
                    ` cleaned their plate: ${pts(top)} to win the night, with `,
                    p,
                    ` serving up ${stat(best)}.`,
                  ],
                ],
                robson: [
                  [
                    w,
                    ` had the best night in the pool, ${pts(top)}, with `,
                    p,
                    ` leading the way: ${stat(best)}.`,
                  ],
                ],
                taylor: scored(best)
                  ? [
                      [
                        w,
                        ` won the night with ${pts(top)}, and the mesh rippled for `,
                        p,
                        `: ${stat(best)}.`,
                      ],
                    ]
                  : [],
              },
              [
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
              ],
            ),
      );
    }
  } else if (winners.length <= MAX_NAMES) {
    lines.push(
      call<BriefLine>(
        "win",
        { cheech: [[...names(winners), ` shared the plate, ${pts(top)} apiece.`]] },
        [
          [...names(winners), ` split the night's spoils, ${pts(top)} apiece.`],
          ["Dead heat for the night's best: ", ...names(winners), ` with ${pts(top)} each.`],
        ],
      ),
    );
  } else {
    lines.push([`A crowded night at the top: ${winners.length} teams tied with ${pts(top)} each.`]);
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
    lines.push([
      "Three stars: number three, ",
      { player: third.name },
      `, ${stat(third)}; number two, `,
      { player: second.name },
      `, ${stat(second)}; and the first star, `,
      { player: first.name },
      `, ${stat(first)}.`,
    ]);
  } else if (
    star &&
    !mentioned.includes(star) &&
    nightPts(star) >= 2 &&
    nightPts(star) > nightPts(scorers[1])
  ) {
    mentioned.push(star);
    const p = { player: star.name };
    const t = { team: star.owner };
    lines.push(
      call<BriefLine>(
        "star",
        {
          cheech: [["Tip of the cap and a side of fries to ", p, `: ${stat(star)} for `, t, "."]],
          taylor: scored(star)
            ? [
                [
                  p,
                  " went top shelf, where Grandma keeps the peanut butter: ",
                  `${stat(star)} for `,
                  t,
                  ".",
                ],
              ]
            : [],
        },
        [
          ["Tip of the cap to ", p, `, who had ${stat(star)} for `, t, "."],
          ["Don't sleep on ", p, `: ${stat(star)} for `, t, "."],
          [t, " will want to frame ", p, `'s night: ${stat(star)}.`],
        ],
      ),
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
      else if (n <= 2) {
        const by = n === 1 ? "a single point" : "just 2 points";
        lines.push(
          call<BriefLine>(
            "lead",
            {
              cheech: [
                [
                  l,
                  " is on top, but ",
                  s,
                  ` is close enough to steal their fries, ${pts(n)} back.`,
                ],
              ],
              taylor: [
                [
                  l,
                  " leads ",
                  s,
                  ` by ${by}. Too close to call, so we'll let Jim Van Horne's moustache decide.`,
                ],
              ],
            },
            [
              [l, " leads ", s, ` by ${by}, so nobody's popping champagne yet.`],
              [l, " is on top, but ", s, ` is right on their tail, ${pts(n)} back.`],
            ],
          ),
        );
      } else if (n < 10)
        lines.push(
          pick("lead", [
            [l, " leads ", s, ` by ${pts(n)}.`],
            [l, ` sits in 1st, ${pts(n)} up on `, s, "."],
          ]),
        );
      else
        lines.push(
          call<BriefLine>(
            "lead",
            {
              cheech: [
                [
                  l,
                  ` is way out in front, ${pts(n)} clear of `,
                  s,
                  ". Save them a seat at the head of the table.",
                ],
              ],
            },
            [
              [l, ` is running away with it, ${pts(n)} clear of `, s, "."],
              [l, ` leads by a country mile: ${pts(n)} over `, s, "."],
            ],
          ),
        );
    }
  } else if (leaders.length <= MAX_NAMES) {
    const at = pts(leaders[0]!.pts);
    lines.push(
      call<BriefLine>(
        "lead",
        {
          taylor: [
            [
              ...names(leaders),
              ` are tied for 1st at ${at}. We'll let Jim Van Horne's moustache sort it out.`,
            ],
          ],
        },
        [
          [...names(leaders), ` are deadlocked for 1st at ${at}. Grab the popcorn.`],
          ["Logjam at the top: ", ...names(leaders), ` are tied at ${at}.`],
        ],
      ),
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
      call<BriefLine>(
        "climb",
        { cheech: [[t, ` is on a roll, up ${how}.`]], shorty: [[t, ` is flying, up ${how}.`]] },
        [
          [t, ` is on the move, up ${how}.`],
          ["Big jump for ", t, `: up ${how}.`],
        ],
      ),
    );
  }
  if (slide) {
    const t = { team: slide.t.name };
    const how = `${plural(-slide.by, "spot")} to ${place(slide.t.rank)}`;
    lines.push(
      call<BriefLine>(
        "slide",
        {
          cheech: [
            [t, ` slipped ${how}, but the cup is half full: there's plenty of hockey left.`],
          ],
          robson: [["Tough sledding for ", t, `, down ${how}.`]],
        },
        [
          ["Rough night for ", t, `, down ${how}.`],
          [t, ` slipped ${how}.`],
        ],
      ),
    );
  }

  // The booth's own segment: Cheech keeps an eye on the injury ward, Don Taylor on the week's
  // hottest team, each falling back on the other's when there's nothing to say
  const ward = teams
    .map((t) => ({ t, out: t.roster.filter((p) => isOut(p.injury)).length }))
    .filter((x) => x.out >= 2)
    .sort((a, b) => b.out - a.out || a.t.rank - b.t.rank)[0];
  const hottest = [...teams].sort((a, b) => b.last7 - a.last7 || a.rank - b.rank)[0];
  // The week's hottest team, when that isn't the leader or last night's winner (both named
  // already) and it's clear of the rest
  const hot =
    hottest &&
    hottest.last7 >= 5 &&
    hottest.rank !== 1 &&
    !winners.includes(hottest) &&
    teams.filter((t) => t.last7 === hottest.last7).length === 1
      ? hottest
      : undefined;
  const wardLine = (): BriefLine | null =>
    ward
      ? booth === "cheech"
        ? [
            "The injury ward for ",
            { team: ward.t.name },
            ` is fuller than a buffet line: ${ward.out} players out.`,
          ]
        : ["Get well soon to ", { team: ward.t.name }, `, with ${ward.out} players out.`]
      : null;
  const hotLine = (): BriefLine | null =>
    hot
      ? [
          "Hottest team in the pool this week: ",
          { team: hot.name },
          `, ${pts(hot.last7)} over the last 7 days.`,
        ]
      : null;
  const extra =
    booth === "cheech"
      ? (wardLine() ?? hotLine())
      : booth === "taylor"
        ? (hotLine() ?? wardLine())
        : null;
  if (extra) lines.push(extra);

  // Teams that had players in action and still got nothing
  const shutOut = teams.filter((t) => t.lastNight === 0 && t.roster.some((p) => p.lastNight));
  if (shutOut.length > MAX_NAMES)
    lines.push(
      call<BriefLine>(
        "blank",
        {
          cheech: [[`${shutOut.length} teams went hungry: not a single point between them.`]],
          taylor: [
            [`${shutOut.length} teams ran into some scintillating goaltending and came up empty.`],
          ],
        },
        [[`${shutOut.length} teams got blanked. The goalies must be sending thank-you cards.`]],
      ),
    );
  else if (shutOut.length)
    lines.push(
      call<BriefLine>(
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
          [...names(shutOut), " came up empty. Shake it off, there's always tomorrow."],
          ["Nothing doing for ", ...names(shutOut), ". The goalies send their regards."],
          [...names(shutOut), " got blanked. Somebody check the Zamboni for their scoring touch."],
        ],
      ),
    );

  // A big night gets a shout: a hat trick from someone named above, or a new leader. Jim Robson
  // calls the player's name twice, the way he called Greg Adams in 1994, and does it for any
  // 4-point night too.
  const hatTrick = mentioned.find((s) => s.lastNight!.g >= 3);
  const bigNight = mentioned.find((s) => nightPts(s) >= 4);
  const shout =
    booth === "robson" && (hatTrick ?? bigNight)
      ? `${(hatTrick ?? bigNight)!.name}! ${(hatTrick ?? bigNight)!.name}!`
      : hatTrick
        ? call(
            "shout",
            {
              shorty: ["Lets it go, he scores!", "He scores, and he scores again!"],
              cheech: [
                "Somebody order that man a burger!",
                "Hats on the ice, ketchup on the side!",
              ],
              taylor: ["Scintillating!"],
            },
            ["Hats on the ice!", "Hat trick alert!", "Throw your caps, folks!"],
          )
        : tookOver
          ? call(
              "shout",
              {
                shorty: ["They've slayed the dragon!"],
                cheech: ["Order up: a new leader!"],
                taylor: ["Hold the Sports Page!"],
              },
              ["Changing of the guard!", "We have a new leader!", "Stop the presses!"],
            )
          : null;

  const open: BriefLine = {
    shorty: pick<BriefLine>("open", [
      ["Here's how last night went down."],
      ["Last night in the pool, from the top."],
    ]),
    cheech: pick<BriefLine>("open", [
      ["Pull up a chair and pass the ketchup: here's last night in the pool."],
      ["Grab a plate, folks. Here's the night that was."],
    ]),
    robson: [
      "A special hello to the hospital patients and shut-ins. Here's last night in the pool.",
    ],
    taylor: pick<BriefLine>("open", [
      ["Time for the Sports Page."],
      ["Here's your Sports Page for the pool."],
    ]),
  }[booth];
  const signoff: BriefLine = {
    shorty: pick<BriefLine>("signoff", [
      ["That's the call. See you at puck drop."],
      ["Back at it at puck drop."],
    ]),
    cheech: pick<BriefLine>("signoff", [
      ["That's the meal. Seconds at puck drop."],
      ["Cup's half full, folks. See you at puck drop."],
    ]),
    robson: ["So long for now, and thanks for listening."],
    taylor: ["And that's it: you're up to date in the world of the WG Hockey Pool."],
  }[booth];

  return { booth, open, shout, lines, signoff };
}
