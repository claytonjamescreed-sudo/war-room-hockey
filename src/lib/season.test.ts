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
    expect(d.available.find((l) => l.id === 9)).toBeUndefined();
  });

  it("projects finish with prior 20 games and 0.45 default rate", () => {
    const d = computeSeason(draft, setup(), raw());
    const a = d.teams.find((t) => t.name === "A")!.roster[0]!;
    // rate = (84/84*20 + 3) / (20 + 2) ; remaining 82
    expect(a.projected).toBe(Math.round(3 + ((20 + 3) / 22) * 82));
    const c = d.teams.find((t) => t.name === "C")!.roster[0]!;
    expect(c.projected).toBe(Math.round(1 + ((0.45 * 20 + 1) / 22) * 82));
  });

  it("last night and last 7 days", () => {
    const d = computeSeason(draft, setup(), raw());
    expect(d.lastDate).toBe("2026-10-01");
    const a = d.teams.find((t) => t.name === "A")!;
    expect(a.lastNight).toBe(1);
    expect(a.last7).toBe(3);
  });
});
