import { describe, expect, it } from "vitest";
import { manGames, perGame, playerManGames, rosterStints } from "./man-games";
import type { Draft, GameLine, Setup } from "./season";

const pick = (n: number, slot: number, team: string) => ({
  pick: n,
  round: 1,
  slot,
  id: n,
  name: `P${n}`,
  team,
  pos: "C",
  preseasonProj: 40,
});
const draft: Draft = {
  season: "test",
  teams: [
    { slot: 1, name: "A" },
    { slot: 2, name: "B" },
  ],
  picks: [pick(1, 1, "EDM"), pick(2, 1, "TOR"), pick(3, 2, "EDM"), pick(4, 2, "MTL")],
};
const setup = (moves: Setup["moves"] = []): Setup => ({
  rules: { countFrom: "2026-10-01", seasonGames: 84, redraftSwaps: 2 },
  moves,
});
const g = (date: string, gameId: number, team: string, opp: string): GameLine => ({
  date,
  gameId,
  team,
  opp,
  home: true,
  g: 0,
  a: 0,
});
const of = (m: Map<number, { played: number; missed: number }>) => Object.fromEntries(m);

describe("perGame", () => {
  it("shows points per game to two decimals, and a dash before the first game", () => {
    expect(perGame(5, 4)).toBe("1.25");
    expect(perGame(7, 7)).toBe("1.00");
    expect(perGame(1, 3)).toBe("0.33");
    expect(perGame(0, 6)).toBe("0.00");
    expect(perGame(0, 0)).toBe("–");
  });
});

describe("manGames", () => {
  // EDM plays games 1, 2 and 3 (3 is against TOR); TOR also plays game 4; MTL plays game 5
  const logs: Record<number, GameLine[]> = {
    // Healthy: every EDM game, and one before the count starts
    1: [
      g("2026-09-30", 90, "EDM", "SEA"),
      g("2026-10-01", 1, "EDM", "CGY"),
      g("2026-10-03", 2, "EDM", "VAN"),
      g("2026-10-05", 3, "EDM", "TOR"),
    ],
    // Sat out game 3, which is only known from the EDM players who dressed for it
    2: [g("2026-10-02", 4, "TOR", "BOS")],
    // Hurt after game 1
    3: [g("2026-10-01", 1, "EDM", "CGY")],
    // Player 4 (MTL) hasn't played at all; a free agent's line shows MTL's game
    9: [g("2026-10-04", 5, "MTL", "OTT")],
  };

  it("counts games played and games the player's NHL team played without him", () => {
    expect(of(manGames(draft, setup(), logs))).toEqual({
      // P1 3 played; P2 1 played, missed game 3
      1: { played: 4, missed: 1 },
      // P3 1 played, missed games 2 and 3; P4 none played, missed MTL's game 5
      2: { played: 1, missed: 3 },
    });
  });

  it("gives each player his own games played and missed", () => {
    const one = playerManGames(draft, setup(), logs);
    expect(one(1)).toEqual({ played: 3, missed: 0 });
    expect(one(2)).toEqual({ played: 1, missed: 1 });
    expect(one(3)).toEqual({ played: 1, missed: 2 });
    // Out since the start: every game of the team he was drafted from
    expect(one(4)).toEqual({ played: 0, missed: 1 });
  });

  it("counts a swapped player only for the days he was on the team", () => {
    const withEarlier = {
      ...logs,
      9: [g("2026-10-02", 6, "MTL", "DET"), g("2026-10-04", 5, "MTL", "OTT")],
    };
    const swap = setup([{ date: "2026-10-04", slot: 2, out: 4, in: 9 }]);
    expect(rosterStints(draft, swap).get(2)).toEqual([
      { id: 3, from: "2026-10-01", to: null },
      { id: 4, from: "2026-10-01", to: "2026-10-04" },
      { id: 9, from: "2026-10-04", to: null },
    ]);
    expect(of(manGames(draft, swap, withEarlier))[2]).toEqual({
      // P3 game 1, and the new player's game 5 on the swap date (not his game 6 before it)
      played: 2,
      // P3 games 2 and 3; P4 missed MTL's game 6 before he was dropped, and not game 5 after
      missed: 3,
    });
    // A player's own row is his whole season, not cut off at the swap
    const one = playerManGames(draft, swap, withEarlier);
    expect(one(9)).toEqual({ played: 2, missed: 0 });
    expect(one(4)).toEqual({ played: 0, missed: 2 });
  });

  it("follows a swap of a swapped-in player", () => {
    const twice = setup([
      { date: "2026-10-03", slot: 1, out: 2, in: 9 },
      { date: "2026-10-05", slot: 1, out: 9, in: 8 },
    ]);
    expect(rosterStints(draft, twice).get(1)).toEqual([
      { id: 1, from: "2026-10-01", to: null },
      { id: 2, from: "2026-10-01", to: "2026-10-03" },
      { id: 9, from: "2026-10-03", to: "2026-10-05" },
      { id: 8, from: "2026-10-05", to: null },
    ]);
  });

  it("follows a traded player to his new NHL team", () => {
    const traded: Record<number, GameLine[]> = {
      // With EDM for game 1, sat out games 2 and 3, then traded: plays for NYR in game 7
      1: [g("2026-10-01", 1, "EDM", "CGY"), g("2026-10-06", 7, "NYR", "NJD")],
      // EDM's games, from a teammate who played them all, including game 9 after the trade
      3: [
        g("2026-10-01", 1, "EDM", "CGY"),
        g("2026-10-03", 2, "EDM", "VAN"),
        g("2026-10-05", 3, "EDM", "TOR"),
        g("2026-10-07", 9, "EDM", "LAK"),
      ],
      // NYR's games 8 (before he arrived) and 10 (after), seen from the other bench
      2: [g("2026-10-04", 8, "TOR", "NYR"), g("2026-10-08", 10, "TOR", "NYR")],
    };
    const m = of(manGames(draft, setup(), traded));
    // P1: played 2; missed EDM's 2 and 3 and NYR's 10, but not NYR's 8 or EDM's 9.
    // P2: played 2; missed TOR's game 3 (known from EDM's line).
    expect(m[1]).toEqual({ played: 4, missed: 4 });
  });

  it("has nothing to count before any game is logged", () => {
    expect(of(manGames(draft, setup(), {}))).toEqual({
      1: { played: 0, missed: 0 },
      2: { played: 0, missed: 0 },
    });
  });
});
