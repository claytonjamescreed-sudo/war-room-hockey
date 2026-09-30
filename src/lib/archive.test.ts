import { describe, expect, it } from "vitest";
import { archiveRows } from "./archive";
import { computeSeason, type Draft, type Raw, type Setup } from "./season";

const draft: Draft = {
  season: "test",
  teams: [
    { slot: 1, name: "A" },
    { slot: 2, name: "B" },
  ],
  picks: [
    { pick: 1, round: 1, slot: 1, id: 1, name: "P1", team: "EDM", pos: "C", preseasonProj: 84 },
    { pick: 2, round: 1, slot: 2, id: 2, name: "P2", team: "TOR", pos: "C", preseasonProj: 42 },
    { pick: 3, round: 2, slot: 2, id: 3, name: "P3", team: "MTL", pos: "D", preseasonProj: 30 },
    { pick: 4, round: 2, slot: 1, id: 4, name: "P4", team: "BOS", pos: "L", preseasonProj: 20 },
  ],
};
const g = (date: string, gameId: number, team: string, gg: number, a: number) => ({
  date,
  gameId,
  team,
  opp: "X",
  home: true,
  g: gg,
  a,
});
const raw: Raw = {
  fetchedAt: "",
  logs: {
    1: [g("2026-10-01", 1, "EDM", 1, 1)],
    2: [g("2026-10-01", 2, "TOR", 0, 1)],
    3: [g("2026-10-01", 3, "MTL", 0, 1)],
    4: [g("2026-10-01", 4, "BOS", 1, 0)],
    9: [g("2026-10-01", 5, "MTL", 2, 0), g("2026-10-03", 6, "MTL", 1, 0)],
  },
  leaders: [{ id: 9, name: "Free", team: "MTL", pos: "R", gp: 2, g: 3, a: 0, pts: 3 }],
  teamGP: {},
  schedule: [],
};
const setup: Setup = {
  rules: { countFrom: "2026-10-01", seasonGames: 84, redraftSwaps: 2 },
  moves: [{ date: "2026-10-02", slot: 2, out: 2, in: 9, inName: "Free" }],
};

describe("roster archive", () => {
  const data = computeSeason(draft, setup, raw);
  const rows = archiveRows("2026-27", data, draft, setup.moves);

  it("one row per team with its finish", () => {
    expect(rows.map((r) => [r.slot, r.team_name, r.rank, r.points])).toEqual([
      [2, "B", 1, 4],
      [1, "A", 2, 3],
    ]);
    expect(rows.every((r) => r.season_id === "2026-27")).toBe(true);
  });

  it("players in draft order, a swap in the place of the player he replaced", () => {
    const b = rows.find((r) => r.slot === 2)!;
    expect(b.players.map((p) => [p.name, p.round, p.pick, p.added])).toEqual([
      ["Free", null, null, "2026-10-02"],
      ["P3", 2, 3, null],
    ]);
    expect(b.players[0]).toMatchObject({ gp: 2, g: 3, a: 0, pts: 3 });
    expect(b.dropped).toEqual([
      {
        id: 2,
        name: "P2",
        team: "TOR",
        pos: "C",
        gp: 1,
        g: 0,
        a: 1,
        pts: 1,
        dropped: "2026-10-02",
        replacedBy: "Free",
      },
    ]);
    const a = rows.find((r) => r.slot === 1)!;
    expect(a.players.map((p) => p.name)).toEqual(["P1", "P4"]);
    expect(a.dropped).toEqual([]);
  });

  it("keeps public data only", () => {
    const keys = new Set(rows.flatMap((r) => r.players.flatMap((p) => Object.keys(p))));
    expect([...keys].sort()).toEqual(
      ["a", "added", "g", "gp", "id", "name", "pick", "pos", "pts", "round", "team"].sort(),
    );
  });
});
