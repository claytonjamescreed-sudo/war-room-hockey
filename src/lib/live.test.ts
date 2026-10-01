import { describe, expect, it } from "vitest";
import { computeLive, gameLabel, hockeyDay, rosterRows, type FeedGame } from "./live";
import { computeSeason, type Draft, type GameLine, type Setup } from "./season";

const draft: Draft = {
  season: "test",
  teams: [
    { slot: 1, name: "Aces" },
    { slot: 2, name: "Bees" },
  ],
  picks: [
    {
      pick: 1,
      round: 1,
      slot: 1,
      id: 1,
      name: "Al Aardvark",
      team: "EDM",
      pos: "C",
      preseasonProj: 80,
    },
    {
      pick: 2,
      round: 1,
      slot: 2,
      id: 2,
      name: "Bo Beaver",
      team: "VAN",
      pos: "C",
      preseasonProj: 80,
    },
    {
      pick: 3,
      round: 2,
      slot: 2,
      id: 3,
      name: "Cy Cougar",
      team: "TOR",
      pos: "D",
      preseasonProj: 40,
    },
    {
      pick: 4,
      round: 2,
      slot: 1,
      id: 4,
      name: "Di Dingo",
      team: "BOS",
      pos: "R",
      preseasonProj: 40,
    },
  ],
};
const setup: Setup = {
  rules: { countFrom: "2026-10-01", seasonGames: 84, redraftSwaps: 2 },
  moves: [],
};
const line = (date: string, gameId: number, team: string, g: number, a: number): GameLine => ({
  date,
  gameId,
  team,
  opp: "XXX",
  home: true,
  g,
  a,
});
const logs: Record<number, GameLine[]> = {
  1: [line("2026-10-01", 101, "EDM", 1, 1)],
  2: [line("2026-10-01", 102, "VAN", 0, 1)],
  3: [],
  4: [],
};
const goal = (
  p: number,
  t: string,
  id: number,
  assists: number[],
  type = "REG",
  away = 0,
  home = 0,
) => ({
  periodDescriptor: { number: p, periodType: type },
  timeInPeriod: t,
  playerId: id,
  name: { default: `P. ${id}` },
  teamAbbrev: "EDM",
  awayScore: away,
  homeScore: home,
  assists: assists.map((a) => ({ playerId: a, name: { default: `P. ${a}` } })),
});
const tonight: FeedGame[] = [
  {
    id: 201,
    gameState: "LIVE",
    startTimeUTC: "2026-10-03T23:00:00Z",
    period: 2,
    periodDescriptor: { number: 2, periodType: "REG" },
    clock: { timeRemaining: "12:34", inIntermission: false },
    awayTeam: { abbrev: "VAN", score: 1 },
    homeTeam: { abbrev: "EDM", score: 2 },
    goals: [
      goal(1, "05:00", 1, [9]),
      goal(1, "15:00", 2, [], "REG", 1, 1),
      goal(2, "02:00", 9, [1], "REG", 1, 2),
    ],
  },
  {
    id: 202,
    gameState: "FUT",
    startTimeUTC: "2026-10-04T02:00:00Z",
    awayTeam: { abbrev: "TOR" },
    homeTeam: { abbrev: "BOS" },
    goals: [],
  },
];

describe("computeLive", () => {
  it("adds tonight's feed points to synced points and re-ranks", () => {
    const live = computeLive({
      date: "2026-10-03",
      feeds: [{ date: "2026-10-03", games: tonight }],
      draft,
      setup,
      logs,
    });
    const aces = live.teams.find((t) => t.name === "Aces")!;
    const bees = live.teams.find((t) => t.name === "Bees")!;
    expect(aces.base).toBe(2);
    expect(aces.tonight).toBe(2); // Aardvark: a goal and an assist
    expect(bees.base).toBe(1);
    expect(bees.tonight).toBe(1);
    expect(aces.total).toBe(4);
    expect(aces.rank).toBe(1);
    expect(live.players[1]).toEqual({ status: "live", g: 1, a: 1, before: { g: 1, a: 1 } });
    expect(live.players[4]!.status).toBe("upcoming");
    expect(aces.playing).toBe(1);
    expect(aces.toPlay).toBe(1);
    expect(bees.toPlay).toBe(1);
    expect(live.anyLive).toBe(true);
  });

  it("builds a newest-first ticker of goals with a pool player in them, with running totals", () => {
    const live = computeLive({
      date: "2026-10-03",
      feeds: [{ date: "2026-10-03", games: tonight }],
      draft,
      setup,
      logs,
    });
    expect(live.ticker.map((t) => t.scorer.name)).toEqual(["P. 9", "Bo Beaver", "Al Aardvark"]);
    expect(live.ticker[2]!.credits).toEqual([{ slot: 1, name: "Aces", pts: 1, total: 3 }]);
    expect(live.ticker[0]!.assists[0]!.owner).toBe("Aces");
    expect(live.ticker[0]!.credits[0]!.total).toBe(4);
    expect(live.ticker[0]!.label).toBe("2nd 02:00");
  });

  it("doesn't count shootout goals", () => {
    const so = [{ ...tonight[0]!, goals: [goal(5, "00:00", 1, [], "SO")] }];
    const live = computeLive({
      date: "2026-10-03",
      feeds: [{ date: "2026-10-03", games: so }],
      draft,
      setup,
      logs,
    });
    expect(live.players[1]!.g).toBe(0);
    expect(live.ticker).toEqual([]);
  });

  it("counts an earlier day's feed only for games the sync hasn't stored", () => {
    const earlier: FeedGame[] = [
      // already synced (game 101 is in the logs): must not count twice
      { id: 101, gameState: "OFF", goals: [goal(1, "01:00", 1, [])] },
      // not synced yet
      { id: 150, gameState: "OFF", goals: [goal(1, "01:00", 3, [2])] },
    ];
    const live = computeLive({
      date: "2026-10-03",
      feeds: [
        { date: "2026-10-03", games: [] },
        { date: "2026-10-02", games: earlier },
      ],
      draft,
      setup,
      logs,
    });
    expect(live.teams.find((t) => t.name === "Aces")!.base).toBe(2);
    expect(live.teams.find((t) => t.name === "Bees")!.base).toBe(3);
    // Per player too: Aardvark's synced game once, Beaver's synced assist plus the unsynced one
    expect(live.players[1]!.before).toEqual({ g: 1, a: 1 });
    expect(live.players[2]!.before).toEqual({ g: 0, a: 2 });
    expect(live.players[3]!.before).toEqual({ g: 1, a: 0 });
    expect(live.anyGames).toBe(false);
  });

  it("uses the roster on tonight's date after a swap", () => {
    const swap: Setup = {
      ...setup,
      moves: [{ date: "2026-10-03", slot: 1, out: 4, in: 9, inName: "Ed Eagle" }],
    };
    const live = computeLive({
      date: "2026-10-03",
      feeds: [{ date: "2026-10-03", games: tonight }],
      draft,
      setup: swap,
      logs,
    });
    expect(live.ticker[0]!.scorer).toMatchObject({ name: "Ed Eagle", owner: "Aces" });
    // Aardvark 1G 1A, and Eagle a goal plus an assist
    expect(live.teams.find((t) => t.name === "Aces")!.tonight).toBe(4);
  });

  it("lists a team's players in draft order, with a game that has started counted as played", () => {
    const live = computeLive({
      date: "2026-10-03",
      feeds: [{ date: "2026-10-03", games: tonight }],
      draft,
      setup,
      logs,
    });
    const season = computeSeason(draft, setup, {
      fetchedAt: "",
      logs,
      leaders: [],
      teamGP: {},
      schedule: [],
    });
    const rows = rosterRows(
      season.teams.find((t) => t.name === "Aces")!,
      live,
    );
    expect(rows.map((r) => [r.p.name, r.round, r.l.gp, r.l.pts, r.left])).toEqual([
      // Aardvark's game is on: 2 played, 4 points, and 82 of his 84 left
      ["Al Aardvark", 1, 2, 4, 82],
      // Dingo's hasn't started
      ["Di Dingo", 2, 0, 0, 84],
    ]);
  });

  it("turns the hockey day over at 3 AM Pacific, not when NHL.com does", () => {
    // 7:37 AM Pacific on Oct 1 (NHL.com's "now" was still on Sep 30)
    expect(hockeyDay(new Date("2026-10-01T14:37:00Z"))).toBe("2026-10-01");
    // A late game: 11:30 PM Pacific is still that day, and so is 2:59 AM
    expect(hockeyDay(new Date("2026-10-02T06:30:00Z"))).toBe("2026-10-01");
    expect(hockeyDay(new Date("2026-10-02T09:59:00Z"))).toBe("2026-10-01");
    expect(hockeyDay(new Date("2026-10-02T10:00:00Z"))).toBe("2026-10-02");
    // Standard time (UTC-8) in January: 3 AM Pacific is 11:00 UTC
    expect(hockeyDay(new Date("2027-01-15T10:59:00Z"))).toBe("2027-01-14");
    expect(hockeyDay(new Date("2027-01-15T11:00:00Z"))).toBe("2027-01-15");
    // An evening game in the east is the same hockey day out west
    expect(hockeyDay(new Date("2026-10-01T23:00:00Z"))).toBe("2026-10-01");
  });

  it("labels games by state", () => {
    expect(gameLabel(tonight[0]!)).toBe("2nd 12:34");
    expect(
      gameLabel({ id: 1, gameState: "OFF", periodDescriptor: { number: 4, periodType: "OT" } }),
    ).toBe("Final/OT");
    expect(gameLabel({ id: 1, gameState: "FUT", startTimeUTC: "2026-10-04T02:00:00Z" })).toBe(
      "7:00 PM PT",
    );
    expect(
      gameLabel({
        id: 1,
        gameState: "LIVE",
        clock: { inIntermission: true },
        periodDescriptor: { number: 1, periodType: "REG" },
      }),
    ).toBe("End of 1st");
  });
});
