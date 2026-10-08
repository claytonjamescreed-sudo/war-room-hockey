import { describe, expect, it } from "vitest";
import {
  BOOTHS,
  boothFor,
  briefText,
  nightBrief,
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

// Reads like finished sentences whichever wording came up
function expectClean(b: Brief) {
  const all = [b.open, ...b.lines, b.signoff].filter((x) => x != null).map(briefText);
  for (const t of [b.shout, ...all].filter((x) => x != null)) {
    expect(t).toMatch(/^[A-Z].*[.!]$/);
    expect(t).not.toMatch(/undefined|null|NaN| {2}| [.,:!]|\.\./);
  }
}

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
  it("hands each game day to the next booth, so no two days in a row sound alike", () => {
    const booths = DATES.slice(0, 12).map(boothFor);
    for (let i = 1; i < booths.length; i++) expect(booths[i]).not.toBe(booths[i - 1]);
    expect(new Set(booths.slice(0, 4))).toEqual(new Set(["shorty", "cheech", "robson", "taylor"]));
    expect(BOOTHS.robson.name).toBe("Jim Robson");
  });

  const s = () =>
    season({ 1: [game(D1, "EDM", 1, 1)], 2: [game(D1, "TOR", 1, 0)], 4: [game(D1, "NYR", 0, 0)] });

  it("opens and signs off in each booth's own voice", () => {
    for (const b of everyWay(s())) {
      expectClean(b);
      expect(b.booth).not.toBeNull();
      expect(b.open).not.toBeNull();
      expect(b.signoff).not.toBeNull();
    }
    for (const b of boothDays(s(), "robson"))
      expect(briefText(b.open!)).toMatch(
        /^A special hello to the hospital patients and shut-ins\./,
      );
    for (const b of boothDays(s(), "taylor"))
      expect(briefText(b.signoff!)).toBe(
        "And that's it: you're up to date in the world of the WG Hockey Pool.",
      );
  });

  it("says each booth's lines some days and the house lines on others", () => {
    const all = (booth: BoothId) =>
      boothDays(s(), booth)
        .map((b) => [b.open, ...b.lines, b.signoff].map((l) => briefText(l!)).join(" "))
        .join(" ");
    expect(all("cheech")).toMatch(/ketchup|plate|meal/);
    expect(all("taylor")).toMatch(/Sports Page/);
    expect(all("shorty")).toMatch(/lets it go, he scores!/);
  });

  it("has Jim Robson call a big night's name twice", () => {
    const big = season({ 1: [game(D1, "EDM", 2, 2)], 2: [game(D1, "TOR", 1, 0)] });
    for (const b of boothDays(big, "robson")) expect(b.shout).toBe("Al Aardvark! Al Aardvark!");
    // A hat trick gets it too; the other booths shout their own way
    const hat = season({ 1: [game(D1, "EDM", 3, 0)], 2: [game(D1, "TOR", 1, 0)] });
    for (const b of boothDays(hat, "robson")) expect(b.shout).toBe("Al Aardvark! Al Aardvark!");
    for (const b of boothDays(hat, "shorty")) expect(b.shout).toMatch(/!$/);
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
        expect(lineWith(b, /^Three stars/)).toBe(
          "Three stars: number three, Cy Cougar, an assist; number two, Bo Beaver, a goal and an assist; and the first star, Al Aardvark, a hat trick and an assist.",
        );
      }
    for (const b of boothDays(season(logs), "cheech"))
      expect(lineWith(b, /^Three stars/)).toBeUndefined();
  });

  it("has Cheech check the injury ward, and Don Taylor the week's hottest team", () => {
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
      expect(lineWith(b, /injury ward/)).toBe(
        "The injury ward for Dogs is fuller than a buffet line: 2 players out.",
      );
    }
    for (const b of boothDays(s, "taylor")) {
      expectClean(b);
      expect(lineWith(b, /Hottest team/)).toBe(
        "Hottest team in the pool this week: Bees, 6 points over the last 7 days.",
      );
    }
    // Without anyone hurt, Cheech names the hottest team instead
    for (const b of boothDays(season(logs), "cheech"))
      expect(lineWith(b, /Hottest team/)).toMatch(/Bees/);
  });
});

describe("nightBrief", () => {
  it("says nothing when no pool player scored", () => {
    const nothing = { booth: null, open: null, shout: null, lines: [], signoff: null };
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
      const lead = lines(b).find((l, i) => i > 0 && /^Aces /.test(l));
      expect(lead).toMatch(/Bees/);
      expect(lead).toMatch(/2 points/);
      const blank = lineWith(b, /empty|blanked|Nothing doing/);
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
      expect(win).toMatch(/Al Aardvark.*a goal and an assist/);
      // Di Dingo's 3 points: the best line, or the first of three stars
      expect(lineWith(b, /Di Dingo/)).toMatch(
        /Di Dingo.*2 goals and an assist|first star, Di Dingo, 2 goals and an assist/,
      );
      expect(lines(b)).toContain("Aces climbs into 1st, 3 points clear of the pack.");
      expect(lineWith(b, /Dogs .*up 2 spots|for Dogs: up 2 spots/)).toMatch(/up 2 spots to T-2nd/);
      expect(lineWith(b, /1 spot to T-2nd/)).toMatch(/Bees/);
      expect(lineWith(b, /empty|blanked|Nothing doing/)).toMatch(/Bees/);
    }
    // A new leader gets a shout every day, Shorthouse's dragon among them
    expect(shouts).toContain("They've slayed the dragon!");
    for (const sh of shouts) expect(sh).toMatch(/!$/);
  });

  it("names the one team in 2nd when a new leader takes over", () => {
    const s = season({ 2: [game(D1, "TOR", 1, 0)], 1: [game(D2, "EDM", 2, 0)] });
    for (const b of everyWay(s)) {
      expectClean(b);
      expect(lines(b)[1]).toMatch(/^Aces (climbs into|grabs the top spot).* 1 point .*Bees\.$/);
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
      expect(win).toMatch(/Aces and Bees .*2 points (apiece|each)/);
      expect(lead).toMatch(/Aces and Bees are (deadlocked for 1st|tied|tied for 1st) at 2 points/);
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
      expect(lines(b)[0]).toMatch(/Aces, Bees, Cats and Dogs .*1 point/);
    }
  });
});
