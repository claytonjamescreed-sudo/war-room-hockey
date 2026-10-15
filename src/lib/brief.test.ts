import { describe, expect, it } from "vitest";
import {
  BOOTHS,
  boothFor,
  briefText,
  nightBrief,
  nth,
  aPointLead,
  statLine,
  type Brief,
  type BoothId,
} from "./brief";
import type { ReportLine } from "./injuries";
import { addDays, computeSeason, type Draft, type GameLine, type Setup } from "./season";

const pick = (n: number, slot: number, name: string, team: string) => ({
  pick: n,
  round: n > 4 ? 2 : 1,
  slot,
  id: n,
  name,
  team,
  pos: "C",
  preseasonProj: 40,
});
const draft: Draft = {
  season: "test",
  teams: [
    { slot: 1, name: "Aces" },
    { slot: 2, name: "Bees" },
    { slot: 3, name: "Cats" },
    { slot: 4, name: "Dogs" },
  ],
  picks: [
    pick(1, 1, "Al Aardvark", "EDM"),
    pick(2, 2, "Bo Beaver", "TOR"),
    pick(3, 3, "Cy Cougar", "VAN"),
    pick(4, 4, "Di Dingo", "NYR"),
    pick(5, 1, "Ed Eel", "BOS"),
    pick(6, 2, "Flo Ferret", "MTL"),
    pick(7, 3, "Gus Gecko", "CGY"),
    pick(8, 4, "Hal Heron", "NJD"),
  ],
};
const setup: Setup = {
  rules: { countFrom: "2026-10-01", seasonGames: 84, redraftSwaps: 2 },
  moves: [],
};
let gameId = 0;
const game = (date: string, team: string, g: number, a: number): GameLine => ({
  date,
  gameId: ++gameId,
  team,
  opp: "XXX",
  home: true,
  g,
  a,
});
const season = (logs: Record<number, GameLine[]>, injuries: ReportLine[] = []) =>
  computeSeason(draft, setup, {
    fetchedAt: "",
    logs,
    leaders: [],
    teamGP: {},
    schedule: [],
    injuries,
    today: "2026-10-15",
  });
// A line of ESPN's injury report for one of the test players (all centres)
const hurt = (name: string, team: string, status: string): ReportLine => {
  const [first, last] = name.split(" ") as [string, string];
  return {
    name,
    first,
    last,
    team,
    pos: "C",
    status,
    detail: "Upper Body",
    returnDate: null,
    note: null,
  };
};

const D1 = "2026-10-01";
const D2 = "2026-10-02";
// The wording rotates with the date, so check every scenario on many dates
const DATES = Array.from({ length: 60 }, (_, i) => addDays(D1, i));
const everyWay = (s: ReturnType<typeof season>) =>
  DATES.map((lastDate) => nightBrief({ ...s, lastDate }));
// The game days one booth calls
const boothDays = (s: ReturnType<typeof season>, booth: BoothId) =>
  DATES.filter((d) => boothFor(d) === booth).map((lastDate) => nightBrief({ ...s, lastDate }));
const lines = (b: Brief) => b.lines.map(briefText);
const lineWith = (b: Brief, re: RegExp) => lines(b).find((l) => re.test(l));
// However a booth says a team got nothing
const BLANK =
  /empty|blanked|Nothing doing|shut out|pointless|No points|Zeroes|nothing to show|hungry/;

// Reads like finished sentences whichever wording came up
function expectClean(b: Brief) {
  const all = [b.open, ...b.lines, b.signoff].filter((x) => x != null).map(briefText);
  for (const t of [b.shout, b.saying, ...all].filter((x) => x != null)) {
    expect(t).toMatch(/^[A-Z].*[.!?]$/);
    expect(t).not.toMatch(/undefined|null|NaN| {2}| [.,:!]|\.\./);
  }
}

describe("aPointLead", () => {
  it("puts an before the numbers that start with a vowel sound", () => {
    expect(aPointLead(5)).toBe("a 5-point lead");
    expect(aPointLead(8)).toBe("an 8-point lead");
    expect(aPointLead(11)).toBe("an 11-point lead");
    expect(aPointLead(18)).toBe("an 18-point lead");
    expect(aPointLead(28)).toBe("a 28-point lead");
    expect(aPointLead(83)).toBe("an 83-point lead");
    expect(aPointLead(110)).toBe("a 110-point lead");
  });
});

describe("statLine", () => {
  it("says a night the way an announcer would", () => {
    expect(statLine(3, 2)).toBe("a hat trick and 2 assists");
    expect(statLine(1, 1)).toBe("a goal and an assist");
    expect(statLine(2, 0)).toBe("2 goals");
    expect(statLine(4, 0)).toBe("4 goals");
    expect(statLine(0, 3)).toBe("3 assists");
  });
});

describe("booths", () => {
  const IDS = Object.keys(BOOTHS) as BoothId[];

  it("hands each game day to the next of five booths, so no two days in a row sound alike", () => {
    const booths = DATES.slice(0, 15).map(boothFor);
    for (let i = 1; i < booths.length; i++) expect(booths[i]).not.toBe(booths[i - 1]);
    expect(new Set(booths.slice(0, 5))).toEqual(new Set(IDS));
    expect(BOOTHS.tommy.name).toBe("Tom Larscheid");
  });

  it("gives every booth a big book of lines, all of them finished sentences", () => {
    for (const id of IDS) {
      const b = BOOTHS[id];
      expect(b.sayings.length).toBeGreaterThanOrEqual(40);
      expect(b.open.length).toBeGreaterThanOrEqual(16);
      expect(b.signoff.length).toBeGreaterThanOrEqual(16);
      for (const list of [b.hatTrick, b.newLeader, b.bigNight])
        expect(list.length).toBeGreaterThanOrEqual(6);
      const all = [
        ...b.open,
        ...b.signoff,
        ...b.sayings,
        ...b.hatTrick,
        ...b.newLeader,
        ...b.bigNight,
      ];
      for (const line of all) {
        const t = typeof line === "string" ? line : line("Al Aardvark");
        expect(t).toMatch(/^[A-Z].*[.!?]$/);
        expect(t).not.toMatch(/ {2}| [.,:!]|\.\./);
      }
      // No line twice in a booth's book
      for (const list of [b.open, b.signoff, b.sayings])
        expect(new Set(list).size).toBe(list.length);
    }
  });

  it("goes through a whole list before anything comes back", () => {
    for (const n of [1, 5, 12, 16, 17, 40, 41]) {
      const list = Array.from({ length: n }, (_, i) => i);
      for (const start of [0, 7, 1000]) {
        const seen = new Set(list.map((_, k) => nth(list, start + k, `key${n}`)));
        expect(seen.size).toBe(n);
      }
    }
  });

  const s = () =>
    season({ 1: [game(D1, "EDM", 1, 1)], 2: [game(D1, "TOR", 1, 0)], 4: [game(D1, "NYR", 0, 0)] });

  it("doesn't repeat a booth's saying, opening or sign-off for a whole season", () => {
    // 40 calls a booth is 200 game days with five booths taking turns
    const days = Array.from({ length: 200 }, (_, i) => addDays(D1, i));
    for (const id of IDS) {
      const briefs = days
        .filter((d) => boothFor(d) === id)
        .map((lastDate) => nightBrief({ ...s(), lastDate }));
      expect(briefs).toHaveLength(40);
      expect(new Set(briefs.map((b) => b.saying)).size).toBe(40);
      expect(new Set(briefs.slice(0, 16).map((b) => briefText(b.open!))).size).toBe(16);
      expect(new Set(briefs.slice(0, 16).map((b) => briefText(b.signoff!))).size).toBe(16);
      for (const b of briefs) {
        expectClean(b);
        expect(b.booth).toBe(id);
      }
    }
  });

  it("says a booth's own lines for the night now and then, not every time", () => {
    const shorty = boothDays(s(), "shorty").map((b) => briefText(b.lines[0]!));
    const own = shorty.filter((l) => /lets it go, he scores!/.test(l)).length;
    expect(own).toBeGreaterThan(0);
    expect(own).toBeLessThan(shorty.length);
    expect(
      boothDays(s(), "robson").some((b) =>
        /hospital patients and shut-ins/.test(briefText(b.open!)),
      ),
    ).toBe(true);
    expect(boothDays(s(), "taylor").some((b) => /up to date/.test(briefText(b.signoff!)))).toBe(
      true,
    );
  });

  it("shouts on a big night in each booth's voice, Robson's name twice among them", () => {
    const big = season({ 1: [game(D1, "EDM", 2, 2)], 2: [game(D1, "TOR", 1, 0)] });
    const robson = boothDays(big, "robson").map((b) => b.shout);
    expect(robson).toContain("Al Aardvark! Al Aardvark!");
    for (const id of IDS) for (const b of boothDays(big, id)) expect(b.shout).toMatch(/!$/);
    // A hat trick too
    const hat = season({ 1: [game(D1, "EDM", 3, 0)], 2: [game(D1, "TOR", 1, 0)] });
    for (const b of everyWay(hat)) expect(b.shout).toMatch(/!$/);
  });

  it("has Jim Robson tip his cap to a day-to-day player who played anyway", () => {
    const logs = { 1: [game(D1, "EDM", 1, 1)], 2: [game(D1, "TOR", 1, 0)] };
    const report = [hurt("Al Aardvark", "EDM", "Day-To-Day")];
    for (const b of boothDays(season(logs, report), "robson")) {
      expectClean(b);
      expect(lineWith(b, /He will play/)).toBe(
        "Al Aardvark is day-to-day on the injury report and still had a goal and an assist for Aces. He will play, you know he will play!",
      );
    }
    // Not when he's healthy
    for (const b of boothDays(season(logs), "robson"))
      expect(lineWith(b, /He will play/)).toBeUndefined();
  });

  it("gives three stars in the Shorthouse and Robson booths", () => {
    const logs = {
      1: [game(D1, "EDM", 3, 1)],
      2: [game(D1, "TOR", 1, 1)],
      3: [game(D1, "VAN", 0, 1)],
    };
    for (const booth of ["shorty", "robson"] as const)
      for (const b of boothDays(season(logs), booth)) {
        expectClean(b);
        const stars = lineWith(b, /three stars/i);
        expect(stars).toMatch(/Al Aardvark/);
        expect(stars).toMatch(/Bo Beaver/);
        expect(stars).toMatch(/Cy Cougar/);
      }
    for (const b of boothDays(season(logs), "cheech"))
      expect(lineWith(b, /three stars/i)).toBeUndefined();
  });

  it("has Garrett check the injury ward, Taylor the week's hottest team, Larscheid the coldest", () => {
    // Dogs have both their players out; Bees have the week's best 7 days without leading
    const logs = {
      1: [game(D1, "EDM", 6, 4)],
      2: [game(addDays(D1, 7), "TOR", 3, 3)],
      3: [game(addDays(D1, 9), "VAN", 0, 1)],
    };
    const report = [hurt("Di Dingo", "NYR", "Injured Reserve"), hurt("Hal Heron", "NJD", "Out")];
    const s = season(logs, report);
    for (const b of boothDays(s, "cheech")) {
      expectClean(b);
      expect(lineWith(b, /2 players out/)).toMatch(/Dogs/);
    }
    for (const b of boothDays(s, "taylor")) {
      expectClean(b);
      expect(lineWith(b, /6 points/)).toMatch(/Bees/);
    }
    // Without anyone hurt, Garrett names the hottest team instead
    for (const b of boothDays(season(logs), "cheech"))
      expect(lineWith(b, /6 points/)).toMatch(/Bees/);
    // The coldest team, when one has half the points of the pool's middle team or fewer: Aces led
    // but had nothing in the last 7 days, while everyone else had 6
    const cold = season({
      1: [game(D1, "EDM", 6, 4)],
      2: [game(addDays(D1, 8), "TOR", 3, 3)],
      3: [game(addDays(D1, 9), "VAN", 3, 3)],
      4: [game(addDays(D1, 10), "NYR", 3, 3)],
    });
    for (const b of boothDays(cold, "tommy")) {
      expectClean(b);
      expect(lineWith(b, /0 points (over|in) the last 7 days|0 points in a week/)).toMatch(/Aces/);
    }
  });
});

describe("nightBrief", () => {
  it("says nothing when no pool player scored", () => {
    const nothing = {
      booth: null,
      open: null,
      shout: null,
      lines: [],
      saying: null,
      signoff: null,
    };
    expect(nightBrief(season({}))).toEqual(nothing);
    expect(nightBrief(season({ 1: [game(D1, "EDM", 0, 0)] }))).toEqual(nothing);
  });

  it("is the same all day and changes from one game day to the next", () => {
    const s = season({ 1: [game(D1, "EDM", 3, 2)], 4: [game(D1, "NYR", 0, 0)] });
    expect(nightBrief(s)).toEqual(nightBrief(s));
    const texts = new Set(everyWay(s).map((b) => [b.shout, ...lines(b)].join(" ")));
    expect(texts.size).toBeGreaterThan(8);
  });

  it("recaps the first game day: a hat trick, the winner, the lead and who got blanked", () => {
    const s = season({
      1: [game(D1, "EDM", 3, 2)],
      2: [game(D1, "TOR", 1, 1)],
      6: [game(D1, "MTL", 0, 1)],
      4: [game(D1, "NYR", 0, 0)],
    });
    for (const b of everyWay(s)) {
      expectClean(b);
      expect(b.shout).toMatch(/!$/);
      const [win] = lines(b);
      expect(win).toMatch(/Al Aardvark/);
      expect(win).toMatch(/Aces/);
      expect(win).toMatch(/a hat trick and 2 assists/);
      expect(win).toMatch(/5 points/);
      // However it's put: "Aces leads Bees…", "Bees sits 2 points behind Aces…"
      const lead = lines(b).find((l, i) => i > 0 && /Aces/.test(l) && /Bees/.test(l));
      expect(lead).toMatch(/Bees/);
      expect(lead).toMatch(/2 points/);
      const blank = lineWith(b, BLANK);
      expect(blank).toMatch(/Dogs/);
      expect(blank).not.toMatch(/Cats/); // nobody on Cats played
    }
  });

  it("names the pool's best line from another team, a new leader and the moves", () => {
    const logs = {
      // Day 1: Bees 3, Aces 2, Cats 1, Dogs 0
      2: [game(D1, "TOR", 2, 1), game(D2, "TOR", 0, 0)],
      1: [game(D1, "EDM", 1, 1), game(D2, "EDM", 1, 1)],
      3: [game(D1, "VAN", 0, 1)],
      // Day 2: Aces 4 (spread over two players), Dogs 3 (one player), Bees blanked, Cats idle
      5: [game(D2, "BOS", 0, 2)],
      4: [game(D2, "NYR", 2, 1)],
      6: [game(D2, "MTL", 0, 0)],
    };
    const s = season(logs);
    expect(Object.fromEntries(s.teams.map((t) => [t.name, [t.pts, t.rank, t.prevRank]]))).toEqual({
      Aces: [6, 1, 2],
      Bees: [3, 2, 1],
      Dogs: [3, 2, 4],
      Cats: [1, 4, 3],
    });
    const shouts = new Set<string>();
    for (const b of everyWay(s)) {
      expectClean(b);
      shouts.add(b.shout!);
      const [win] = lines(b);
      expect(win).toMatch(/Aces.*4 points|Al Aardvark.*Aces/);
      expect(win).toMatch(/Al Aardvark/);
      expect(win).toMatch(/a goal and an assist/);
      // Di Dingo's 3 points: the best line, or the first of three stars
      expect(lineWith(b, /Di Dingo/)).toBeDefined();
      expect(lineWith(b, /of the pack/)).toMatch(/^Aces .*3 points (clear|ahead) of the pack\.$/);
      expect(lineWith(b, /2 spots to T-2nd/)).toMatch(/Dogs/);
      expect(lineWith(b, /1 spot to T-2nd/)).toMatch(/Bees/);
      expect(lineWith(b, BLANK)).toMatch(/Bees/);
    }
    // A new leader gets a shout every day, Shorthouse's dragon among them
    expect(shouts).toContain("They've slayed the dragon!");
    for (const sh of shouts) expect(sh).toMatch(/!$/);
  });

  it("names the one team in 2nd when a new leader takes over", () => {
    const s = season({ 2: [game(D1, "TOR", 1, 0)], 1: [game(D2, "EDM", 2, 0)] });
    for (const b of everyWay(s)) {
      expectClean(b);
      expect(lines(b)[1]).toMatch(/^Aces .* 1 point .*Bees\.$/);
    }
  });

  it("returns team and player names as their own parts, for links", () => {
    const b = nightBrief(season({ 1: [game(D1, "EDM", 1, 1)] }));
    expect(b.lines[0]).toContainEqual({ team: "Aces" });
    expect(b.lines[0]).toContainEqual({ player: "Al Aardvark" });
  });

  it("handles a shared night and a tie for 1st", () => {
    const s = season({ 1: [game(D1, "EDM", 1, 1)], 2: [game(D1, "TOR", 0, 2)] });
    for (const b of everyWay(s)) {
      expectClean(b);
      expect(b.shout).toBeNull();
      const [win, lead, ...rest] = lines(b);
      expect(rest).toEqual([]);
      expect(win).toMatch(/Aces and Bees/);
      expect(win).toMatch(/2 points/);
      expect(lead).toMatch(/Aces and Bees/);
      expect(lead).toMatch(/1st|the top/);
      expect(lead).toMatch(/2 points/);
    }
  });

  it("lists up to four teams that share the night by name", () => {
    const s = season({
      1: [game(D1, "EDM", 1, 0)],
      2: [game(D1, "TOR", 1, 0)],
      3: [game(D1, "VAN", 1, 0)],
      4: [game(D1, "NYR", 1, 0)],
    });
    for (const b of everyWay(s)) {
      expectClean(b);
      expect(lines(b)[0]).toMatch(/Aces, Bees, Cats and Dogs/);
      expect(lines(b)[0]).toMatch(/1 point/);
    }
  });
});
