import { describe, expect, it } from "vitest";
import { FINISHES, STORIES } from "../data/history";
import { hypeLine, locker, margin, ord, place, pools, records, teamNames } from "./history";

describe("pool history", () => {
  it("has six regular seasons and six playoff pools, newest first", () => {
    const p = pools();
    expect(p).toHaveLength(12);
    expect(p.map((x) => x.key).slice(0, 3)).toEqual(["P|2026", "R|2025-26", "P|2025"]);
    expect(p.at(-1)!.key).toBe("R|2020-21");
    // Every pool has one champion and every team once
    for (const pool of p) {
      expect(pool.rows.filter((f) => f.r === 1)).toHaveLength(1);
      expect(new Set(pool.rows.map((f) => f.t)).size).toBe(pool.rows.length);
      expect(pool.rows.length).toBe(pool.rows[0]!.n);
    }
  });

  it("champions and margins match the stories", () => {
    const p = pools();
    const season = (key: string) => p.find((x) => x.key === key)!;
    expect(season("R|2025-26").rows[0]!.t).toBe("ACE");
    expect(margin(season("R|2025-26"))).toBe(47);
    expect(season("R|2020-21").rows[0]!.t).toBe("Redlight");
    expect(margin(season("R|2020-21"))).toBe(1);
    expect(season("P|2026").rows[0]!.t).toBe("Rogersrabbits");
  });

  it("records", () => {
    const r = records();
    expect(r.titles).toEqual({ n: 3, who: ["ACE"] });
    expect(r.bestSeason.t).toBe("ACE");
    expect(r.bestSeason.p).toBe(736);
    expect(r.bestPlayoff).toMatchObject({ t: "Unomas", s: "2024", p: 137 });
    expect(r.poolCount).toBe(12);
  });

  it("a team's locker", () => {
    const ace = locker("ACE")!;
    expect(ace.titles.map((f) => `${f.k} ${f.s}`)).toEqual(["R 2025-26", "P 2023", "R 2021-22"]);
    expect(ace.rows).toHaveLength(12);
    expect(Math.max(...ace.rows.map((f) => f.r))).toBe(8); // never worse than 8th
    expect(ace.aka).toEqual(["Ace"]);
    expect(ace.fullSeasons).toBe(5);
    expect(ace.playedShort).toBe(true);
    const tw = locker("The Wheeler")!;
    expect(tw.aka).toContain("TW3");
    expect(tw.gapToFirst(tw.rows.find((f) => f.s === "2025-26")!)).toBe(736 - 676);
    expect(locker("Nobody")).toBeNull();
  });

  it("every team has a scouting report, and the fallback reads right", () => {
    for (const t of teamNames()) expect(STORIES[t]).toBeDefined();
    const one = locker("Parker", FINISHES)!;
    expect(hypeLine(one)).toBe(
      "Still hunting that first podium. Every dynasty starts with a draft.",
    );
    expect(hypeLine(locker("ACE")!)).toBe(
      "3-time champion. Everyone else is drafting to catch ACE.",
    );
  });

  it("places and ties", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ord)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
    const tied = FINISHES.find((f) => f.tie)!;
    expect(place(tied).startsWith("T-")).toBe(true);
  });
});
