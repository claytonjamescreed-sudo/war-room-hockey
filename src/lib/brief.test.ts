import { describe, expect, it } from "vitest";
import { briefText, nightBrief, statLine, type Brief } from "./brief";
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
const season = (logs: Record<number, GameLine[]>) =>
  computeSeason(draft, setup, { fetchedAt: "", logs, leaders: [], teamGP: {}, schedule: [] });

const D1 = "2026-10-01";
const D2 = "2026-10-02";
// The wording rotates with the date, so check every scenario on many dates
const DATES = Array.from({ length: 60 }, (_, i) => addDays(D1, i));
const everyWay = (s: ReturnType<typeof season>) =>
  DATES.map((lastDate) => nightBrief({ ...s, lastDate }));
const lines = (b: Brief) => b.lines.map(briefText);

// Reads like finished sentences whichever wording came up
function expectClean(b: Brief) {
  for (const t of [b.shout, ...lines(b)].filter((x) => x != null)) {
    expect(t).toMatch(/^[A-Z].*[.!]$/);
    expect(t).not.toMatch(/undefined|null|NaN| {2}| [.,:!]|\.\./);
  }
}

const HAT_TRICK = ["Hats on the ice!", "Hat trick alert!", "Throw your caps, folks!"];
const NEW_LEADER = ["Changing of the guard!", "We have a new leader!", "Stop the presses!"];

describe("statLine", () => {
  it("says a night the way an announcer would", () => {
    expect(statLine(3, 2)).toBe("a hat trick and 2 assists");
    expect(statLine(1, 1)).toBe("a goal and an assist");
    expect(statLine(2, 0)).toBe("2 goals");
    expect(statLine(4, 0)).toBe("4 goals");
    expect(statLine(0, 3)).toBe("3 assists");
  });
});

describe("nightBrief", () => {
  it("says nothing when no pool player scored", () => {
    expect(nightBrief(season({}))).toEqual({ shout: null, lines: [] });
    expect(nightBrief(season({ 1: [game(D1, "EDM", 0, 0)] })).lines).toEqual([]);
  });

  it("is the same all day and changes from one game day to the next", () => {
    const s = season({ 1: [game(D1, "EDM", 3, 2)], 4: [game(D1, "NYR", 0, 0)] });
    expect(nightBrief(s)).toEqual(nightBrief(s));
    const texts = new Set(everyWay(s).map((b) => [b.shout, ...lines(b)].join(" ")));
    expect(texts.size).toBeGreaterThan(3);
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
      expect(HAT_TRICK).toContain(b.shout);
      const [win, lead, blank, ...rest] = lines(b);
      expect(rest).toEqual([]);
      expect(win).toMatch(/Al Aardvark/);
      expect(win).toMatch(/Aces/);
      expect(win).toMatch(/a hat trick and 2 assists/);
      expect(win).toMatch(/5 points/);
      expect(lead).toMatch(/^Aces .*Bees/);
      expect(lead).toMatch(/2 points/);
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
    for (const b of everyWay(s)) {
      expectClean(b);
      expect(NEW_LEADER).toContain(b.shout);
      const [win, star, lead, climb, slide, blank, ...rest] = lines(b);
      expect(rest).toEqual([]);
      expect(win).toMatch(/Aces.*4 points|Al Aardvark.*Aces/);
      expect(win).toMatch(/Al Aardvark .*a goal and an assist/);
      expect(star).toMatch(/Di Dingo/);
      expect(star).toMatch(/2 goals and an assist/);
      expect(star).toMatch(/Dogs/);
      expect(lead).toBe("Aces climbs into 1st, 3 points clear of the pack.");
      expect(climb).toMatch(/Dogs.*up 2 spots to T-2nd/);
      expect(slide).toMatch(/Bees.*1 spot to T-2nd/);
      expect(blank).toMatch(/Bees/);
    }
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
      expect(lead).toMatch(/Aces and Bees are (deadlocked for 1st|tied) at 2 points/);
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
