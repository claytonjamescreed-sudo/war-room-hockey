import { describe, expect, it } from "vitest";
import { computeSeason, type Draft, type Raw, type Setup } from "./season";

const draft: Draft = {
  season: "test",
  teams: [
    { slot: 1, name: "A" },
    { slot: 2, name: "B" },
    { slot: 3, name: "C" },
  ],
  picks: [
    { pick: 1, round: 1, slot: 1, id: 1, name: "P1", team: "EDM", pos: "C", preseasonProj: 84 },
    { pick: 2, round: 1, slot: 2, id: 2, name: "P2", team: "TOR", pos: "C", preseasonProj: 42 },
    { pick: 3, round: 1, slot: 3, id: 3, name: "P3", team: "MTL", pos: "D", preseasonProj: null },
  ],
};
const g = (date: string, gameId: number, team: string, gg: number, a: number) => ({
  date, gameId, team, opp: "X", home: true, g: gg, a,
});
const raw = (): Raw => ({
  fetchedAt: "",
  logs: {
    1: [g("2026-09-28", 0, "EDM", 5, 5), g("2026-09-29", 1, "EDM", 1, 1), g("2026-10-01", 2, "EDM", 0, 1)],
    2: [g("2026-09-29", 3, "TOR", 1, 1), g("2026-10-01", 4, "TOR", 0, 0)],
    3: [g("2026-09-29", 5, "MTL", 0, 1)],
    9: [g("2026-09-29", 6, "MTL", 2, 0), g("2026-10-01", 7, "MTL", 1, 0)],
  },
  leaders: [{ id: 9, name: "Free", team: "MTL", pos: "L", gp: 2, g: 3, a: 0, pts: 3 }],
  teamGP: { EDM: 2, TOR: 2, MTL: 2 },
  schedule: [],
});
const setup = (moves: Setup["moves"] = []): Setup => ({
  rules: { countFrom: "2026-09-29", seasonGames: 84, redraftSwaps: 2 },
  moves,
});

describe("computeSeason (port of season.js)", () => {
  it("counts only games from countFrom and ties share a rank", () => {
    const d = computeSeason(draft, setup(), raw());
    const by = Object.fromEntries(d.teams.map((t) => [t.name, t])) as Record<"A" | "B" | "C", (typeof d.teams)[number]>;
    expect(by.A.pts).toBe(3);
    expect(by.B.pts).toBe(2);
    expect(d.history.dates).toEqual(["2026-09-29", "2026-10-01"]);
    expect(d.history.totals[1]).toEqual([2, 3]);
    expect(by.A.prevRank).toBe(1);
    expect(by.B.rank).toBe(2);
    expect(by.C.rank).toBe(3);
    expect(by.A.back).toBe(0);
    expect(by.B.back).toBe(1);
  });

  it("applies a swap from its date: new player's whole season counts", () => {
    const d = computeSeason(draft, setup([{ date: "2026-10-01", slot: 3, out: 3, in: 9 }]), raw());
    const c = d.teams.find((t) => t.name === "C")!;
    // Before 10-01 the old roster (P3: 1) counts; from 10-01 Free counts for his whole season (3)
    expect(d.history.totals[3]).toEqual([1, 3]);
    expect(c.pts).toBe(3);
    expect(c.dropped[0]!.name).toBe("P3");
    expect(c.swapsUsed).toBe(1);
    expect(c.roster.map((p) => p.id)).toEqual([9]);
    // In draft order, the new player takes the dropped player's place, with no round
    expect(c.drafted).toEqual([{ id: 9, round: null }]);
    expect(d.teams.find((t) => t.name === "A")!.drafted).toEqual([{ id: 1, round: 1 }]);
    expect(d.available.find((l) => l.id === 9)).toBeUndefined();
  });

  it("adds games left and man games without changing the port's numbers", () => {
    const d = computeSeason(draft, setup(), raw());
    const by = Object.fromEntries(d.teams.map((t) => [t.name, t])) as Record<
      "A" | "B" | "C",
      (typeof d.teams)[number]
    >;
    // Each NHL team has played 2 of 84
    expect(by.A.roster[0]!.left).toBe(82);
    expect(by.A.roster[0]!.missed).toBe(0);
    expect(by.C.roster[0]!.missed).toBe(2);
    // P1's game before countFrom doesn't count; he and P2 dressed for both of their teams' games
    expect(by.A.manGames).toEqual({ played: 2, missed: 0, left: 82 });
    expect(by.B.manGames).toEqual({ played: 2, missed: 0, left: 82 });
    // P3 dressed for one MTL game; Free's lines show two more MTL games he wasn't in
    expect(by.C.manGames).toEqual({ played: 1, missed: 2, left: 82 });

    // After a swap the dropped player counts up to the swap date and the new one from it
    const swapped = computeSeason(
      draft,
      setup([{ date: "2026-10-01", slot: 3, out: 3, in: 9 }]),
      raw(),
    ).teams.find((t) => t.name === "C")!;
    // P3's game on 09-29 and Free's on 10-01; P3 missed Free's 09-29 game, Free none since joining
    expect(swapped.manGames).toEqual({ played: 2, missed: 1, left: 82 });
    // Free's own row is his whole season, like his points: 2 games, and the MTL game P3 was in
    expect(swapped.roster[0]).toMatchObject({ id: 9, gp: 2, missed: 1, left: 82 });
  });

  it("finds each player's next game in the week's schedule", () => {
    const d = computeSeason(draft, setup(), {
      ...raw(),
      schedule: [
        // Last night's games are over
        { date: "2026-10-01", games: [{ state: "OFF", away: "EDM", home: "TOR", start: "2026-10-01T23:00:00Z" }] },
        { date: "2026-10-02", games: [{ state: "FUT", away: "TOR", home: "EDM", start: "2026-10-03T01:00:00Z" }] },
        { date: "2026-10-04", games: [{ state: "FUT", away: "EDM", home: "CGY", start: "2026-10-05T01:00:00Z" }] },
      ],
    });
    const next = Object.fromEntries(d.teams.map((t) => [t.name, t.roster[0]!.nextGame]));
    expect(next["A"]).toEqual({ date: "2026-10-02", opp: "TOR", home: true, start: "2026-10-03T01:00:00Z" });
    expect(next["B"]).toEqual({ date: "2026-10-02", opp: "EDM", home: false, start: "2026-10-03T01:00:00Z" });
    // MTL has nothing this week
    expect(next["C"]).toBeNull();
  });

  it("projects finish with prior 20 games and 0.45 default rate, per game played", () => {
    const d = computeSeason(draft, setup(), raw());
    const a = d.teams.find((t) => t.name === "A")!.roster[0]!;
    // rate = (84/84*20 + 3) / (20 + 2 games played) ; remaining 82
    expect(a.projected).toBe(Math.round(3 + ((20 + 3) / 22) * 82));
    const c = d.teams.find((t) => t.name === "C")!.roster[0]!;
    // P3 played 1 of MTL's 2 games: the rate is over the game he played, not the one he sat out
    // (season.js divided by the team's 2, which gave 38)
    expect(c.projected).toBe(Math.round(1 + ((0.45 * 20 + 1) / 21) * 82));
    expect(c.projected).toBe(40);
    expect(c.expectedOut).toBe(0);
    expect(c.injury).toBeUndefined();
  });

  it("leaves the games a hurt player is expected to miss out of his projection", () => {
    const hurt = (returnDate: string | null, status = "Injured Reserve") => ({
      name: "P1",
      first: "P1",
      last: "",
      team: "EDM",
      pos: "C",
      status,
      detail: "Lower Body",
      returnDate,
      note: null,
    });
    const week = [
      { date: "2026-10-01", games: [{ state: "OFF", away: "EDM", home: "TOR", start: "" }] },
      { date: "2026-10-02", games: [{ state: "FUT", away: "TOR", home: "EDM", start: "" }] },
      { date: "2026-10-04", games: [{ state: "FUT", away: "EDM", home: "CGY", start: "" }] },
      { date: "2026-10-06", games: [{ state: "FUT", away: "MTL", home: "EDM", start: "" }] },
    ];
    const p1 = (injuries: ReturnType<typeof hurt>[]) =>
      computeSeason(draft, setup(), { ...raw(), schedule: week, injuries, today: "2026-10-02" })
        .teams.find((t) => t.name === "A")!.roster[0]!;
    const rate = (20 + 3) / 22;

    // Healthy: all 82 of EDM's games left
    expect(p1([])).toMatchObject({ expectedOut: 0, projected: Math.round(3 + rate * 82) });
    // Back on the 5th: he misses the games on the 2nd and the 4th, not the one on the 6th
    const backSoon = p1([hurt("2026-10-05")]);
    expect(backSoon.injury).toMatchObject({ label: "IR", returnDate: "2026-10-05" });
    expect(backSoon).toMatchObject({ expectedOut: 2, projected: Math.round(3 + rate * 80) });
    // Back in five weeks: the three games in the week's schedule, then about 3 a week after it
    // (30 days from the 7th to Nov 6 at 84 games in 195 days is 13)
    expect(p1([hurt("2026-11-06")])).toMatchObject({
      expectedOut: 16,
      projected: Math.round(3 + rate * 66),
    });
    // No return date: nothing to go on, so nothing is taken off
    expect(p1([hurt(null)])).toMatchObject({ expectedOut: 0, projected: Math.round(3 + rate * 82) });
    // His points and his team's rank don't move, only the projection
    expect(p1([hurt("2026-11-06")]).pts).toBe(3);
  });

  it("last night and last 7 days", () => {
    const d = computeSeason(draft, setup(), raw());
    expect(d.lastDate).toBe("2026-10-01");
    const a = d.teams.find((t) => t.name === "A")!;
    expect(a.lastNight).toBe(1);
    expect(a.last7).toBe(3);
  });
});
