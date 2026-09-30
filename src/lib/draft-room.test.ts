import { describe, expect, test } from "vitest";
import {
  mockTeamCount,
  mySlotFor,
  nameMatches,
  newMock,
  ordinal,
  randomizeOrder,
  readPrefs,
} from "./draft-room";

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("readPrefs", () => {
  test("keeps known fields and drops junk", () => {
    const p = readPrefs({
      settings: { market: "pool", weights: { trend: 0.7, bad: "x" }, myTeam: "ACE", mySlot: null },
      starred: [1, "2", 3],
      avoid: "nope",
      contract: { "8478402": true, x: 1 },
    });
    expect(p).toEqual({
      settings: { market: "pool", weights: { trend: 0.7 }, myTeam: "ACE", mySlot: null },
      starred: [1, 3],
      avoid: [],
      contract: { "8478402": true },
    });
    expect(readPrefs(null)).toEqual({ settings: {}, starred: [], avoid: [], contract: {} });
  });
});

describe("mySlotFor", () => {
  const names = { 1: "LiteMan", 11: "ACE" };
  test("your team's place in the order", () => {
    expect(mySlotFor(names, 15, "ACE", 3)).toBe(11);
  });
  test("a tapped slot while your team isn't placed, unless someone else has it", () => {
    expect(mySlotFor({ 1: "LiteMan" }, 15, "ACE", 3)).toBe(3);
    expect(mySlotFor({ 3: "LiteMan" }, 15, "ACE", 3)).toBeNull();
    expect(mySlotFor({}, 15, "ACE", 16)).toBeNull();
  });
});

describe("randomizeOrder", () => {
  test("fills empty slots with last season's teams, then shuffles all of them", () => {
    const r = randomizeOrder(["ACE", "", "", ""], ["ACE", "Bzilla", "TW3"], () => 0)!;
    expect(r.filled).toBe(2);
    expect([...r.list].sort()).toEqual(["", "ACE", "Bzilla", "TW3"]);
    expect(r.list[3]).toBe(""); // the slot nobody fills stays last
  });
  test("needs two teams", () => {
    expect(randomizeOrder(["ACE", ""], [], () => 0)).toBeNull();
  });
  test("every team keeps exactly one slot", () => {
    const names = Array.from({ length: 15 }, (_, i) => `T${i + 1}`);
    const r = randomizeOrder(names, [])!;
    expect(new Set(r.list).size).toBe(15);
  });
});

describe("mock drafts", () => {
  const pool = [
    { name: "ACE", lean: { list: 0.3 } },
    { name: "Bzilla", note: "goes by last season" },
    { name: "TW3" },
  ];
  test("last season's teams: you plus the others", () => {
    expect(mockTeamCount("teams", pool, "ACE", 15)).toBe(3);
    expect(mockTeamCount("pool", pool, "ACE", 15)).toBe(15);
    const m = newMock(
      { style: "teams", slot: 2, speed: "watch", auto: false, others: "cpu" },
      { teams: 15, rounds: 10, teamNames: { 1: "ACE" } },
      pool,
      "ACE",
      seq([0.1, 0.9, 0.5, 0.3, 0.7]),
    );
    expect(m.teams).toBe(3);
    expect(m.mySlot).toBe(2);
    expect(m.teamNames[2]).toBe("ACE");
    expect(Object.keys(m.cpu).map(Number).sort()).toEqual([1, 3]);
    expect(new Set([m.teamNames[1], m.teamNames[3]])).toEqual(new Set(["Bzilla", "TW3"]));
    for (const c of Object.values(m.cpu)) {
      expect(c.style).toBe("pool");
      expect(c.noise).toBeGreaterThanOrEqual(0.6);
      expect(c.noise).toBeLessThanOrEqual(1.4);
    }
  });
  test("a styled mock keeps the real names but never puts yours in another slot", () => {
    const m = newMock(
      { style: "espn", slot: 4, speed: "instant", auto: true, others: "cpu" },
      { teams: 15, rounds: 10, teamNames: { 1: "LiteMan", 4: "Brayker", 11: "ACE" } },
      pool,
      "ACE",
      seq([0.5]),
    );
    expect(m.teams).toBe(15);
    expect(m.teamNames).toEqual({ 1: "LiteMan" });
    expect(Object.keys(m.cpu)).toHaveLength(14);
    expect(m.cpu[1]!.style).toBe("espn");
  });
});

test("small helpers", () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
    "101st",
  ]);
  expect(nameMatches("Tim Stützle", "OTT", "stutzle ott")).toBe(true);
  expect(nameMatches("Tim Stützle", "OTT", "stutzle edm")).toBe(false);
});
