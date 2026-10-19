// The race chart's numbers: every team's place in the pool on every game day, from the season's
// saved totals. Pure, tested in race.test.ts.
//
// A team's rank is the standings' rank (teams on the same points share it, the next rank skips:
// 1, 2, 2, 4). For drawing, teams on the same points still need a line each, so each day also
// gets an order with no ties: by points, then the order the day before (so tied lines don't swap
// back and forth), and on the first day by name.

export type RacePlace = { rank: number; order: number; pts: number };
export type RaceDay = { date: string; places: Record<number, RacePlace> };

export function racePlaces(
  teams: { slot: number; name: string }[],
  dates: string[],
  totals: Record<number, number[]>,
): RaceDay[] {
  const slots = teams.map((t) => t.slot);
  const name = new Map(teams.map((t) => [t.slot, t.name]));
  let before = [...slots].sort((a, b) => name.get(a)!.localeCompare(name.get(b)!));
  return dates.map((date, i) => {
    const pts = (s: number) => totals[s]?.[i] ?? 0;
    const order = [...slots].sort(
      (a, b) => pts(b) - pts(a) || before.indexOf(a) - before.indexOf(b),
    );
    const places: Record<number, RacePlace> = {};
    for (const s of slots)
      places[s] = {
        rank: 1 + slots.filter((o) => pts(o) > pts(s)).length,
        order: order.indexOf(s) + 1,
        pts: pts(s),
      };
    before = order;
    return { date, places };
  });
}

// A team's best and worst place over the season
export function placeRange(days: RaceDay[], slot: number) {
  const ranks = days.map((d) => d.places[slot]?.rank).filter((r): r is number => r != null);
  return ranks.length ? { best: Math.min(...ranks), worst: Math.max(...ranks) } : null;
}

// "1st", "T-6th" on a day when another team had the same points
export function placeName(day: RaceDay | undefined, slot: number, ord: (n: number) => string) {
  const p = day?.places[slot];
  if (!p) return "";
  const tied = Object.values(day!.places).filter((o) => o.rank === p.rank).length > 1;
  return `${tied ? "T-" : ""}${ord(p.rank)}`;
}

// Picking out teams: at most `max` at once, each keeping its colour (0 to max - 1) while picked.
// Picking one more than that lets the earliest pick go.
export function togglePick(picked: { slot: number; colour: number }[], slot: number, max = 3) {
  if (picked.some((p) => p.slot === slot)) return picked.filter((p) => p.slot !== slot);
  const kept = picked.length >= max ? picked.slice(1) : picked;
  const used = new Set(kept.map((p) => p.colour));
  const colour = [...Array(max).keys()].find((c) => !used.has(c)) ?? 0;
  return [...kept, { slot, colour }];
}
