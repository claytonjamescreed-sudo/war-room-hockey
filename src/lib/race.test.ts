import { describe, expect, it } from "vitest";
import { ord } from "./history";
import { placeName, placeRange, racePlaces, spreadLabels, togglePick } from "./race";

const teams = [
  { slot: 1, name: "Aces" },
  { slot: 2, name: "Bees" },
  { slot: 3, name: "Cats" },
  { slot: 4, name: "Dogs" },
];
const dates = ["2026-10-01", "2026-10-02", "2026-10-03"];
const totals = {
  1: [3, 4, 9],
  2: [5, 6, 6],
  3: [3, 6, 6],
  4: [0, 1, 8],
};

describe("racePlaces", () => {
  const days = racePlaces(teams, dates, totals);

  it("gives each team the standings' rank every day, shared on the same points", () => {
    expect(days.map((d) => [1, 2, 3, 4].map((s) => d.places[s]!.rank))).toEqual([
      [2, 1, 2, 4],
      [3, 1, 1, 4],
      [1, 3, 3, 2],
    ]);
    expect(days[2]!.places[1]!.pts).toBe(9);
  });

  it("knows how far each team was behind that day's leader", () => {
    expect(days.map((d) => [1, 2, 3, 4].map((s) => d.places[s]!.back))).toEqual([
      [2, 0, 2, 5],
      [2, 0, 0, 5],
      [0, 3, 3, 1],
    ]);
  });

  it("draws teams on the same points one below the other, keeping the day before's order", () => {
    // Day 1: Aces and Cats tied, by name; day 2: Bees and Cats tied, Bees was ahead; day 3: Bees
    // and Cats still tied, still in that order
    expect(days.map((d) => [1, 2, 3, 4].map((s) => d.places[s]!.order))).toEqual([
      [2, 1, 3, 4],
      [3, 1, 2, 4],
      [1, 3, 4, 2],
    ]);
    // Every day, one line per place
    for (const d of days)
      expect(new Set(Object.values(d.places).map((p) => p.order))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("names a place the way the standings do", () => {
    expect(placeName(days[1], 2, ord)).toBe("T-1st");
    expect(placeName(days[1], 1, ord)).toBe("3rd");
    expect(placeName(days[2], 1, ord)).toBe("1st");
    expect(placeName(undefined, 1, ord)).toBe("");
  });

  it("knows each team's best and worst place", () => {
    expect(placeRange(days, 1)).toEqual({ best: 1, worst: 3 });
    expect(placeRange(days, 4)).toEqual({ best: 2, worst: 4 });
    expect(placeRange([], 1)).toBeNull();
  });
});

describe("togglePick", () => {
  it("picks up to three teams, each keeping its colour, and lets the earliest go for a fourth", () => {
    let p = togglePick([], 5);
    p = togglePick(p, 7);
    p = togglePick(p, 9);
    expect(p).toEqual([
      { slot: 5, colour: 0 },
      { slot: 7, colour: 1 },
      { slot: 9, colour: 2 },
    ]);
    // Unpicking frees a colour without repainting the others
    p = togglePick(p, 7);
    expect(p).toEqual([
      { slot: 5, colour: 0 },
      { slot: 9, colour: 2 },
    ]);
    p = togglePick(p, 3);
    expect(p).toContainEqual({ slot: 3, colour: 1 });
    // A fourth lets the earliest (5) go and takes its colour
    p = togglePick(p, 11);
    expect(p.map((x) => x.slot)).toEqual([9, 3, 11]);
    expect(p).toContainEqual({ slot: 11, colour: 0 });
  });
});

describe("spreadLabels", () => {
  const ys = (m: Map<number, number>) =>
    [...m.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);

  it("leaves labels that are far enough apart where they are", () => {
    expect(
      ys(
        spreadLabels(
          [
            { id: 1, y: 10 },
            { id: 2, y: 50 },
            { id: 3, y: 90 },
          ],
          14,
          0,
          200,
        ),
      ),
    ).toEqual([10, 50, 90]);
  });

  it("pushes bunched labels apart, in order, keeping same-spot labels in the order given", () => {
    const laid = spreadLabels(
      [
        { id: 1, y: 100 },
        { id: 2, y: 100 },
        { id: 3, y: 105 },
        { id: 4, y: 40 },
      ],
      14,
      0,
      300,
    );
    expect(ys(laid)).toEqual([100, 114, 128, 40]);
  });

  it("pulls labels back up when they would run off the bottom", () => {
    const laid = spreadLabels(
      [
        { id: 1, y: 190 },
        { id: 2, y: 195 },
        { id: 3, y: 200 },
      ],
      14,
      0,
      200,
    );
    expect(ys(laid)).toEqual([172, 186, 200]);
  });
});
