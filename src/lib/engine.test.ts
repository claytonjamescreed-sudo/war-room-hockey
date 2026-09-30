import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SETTINGS,
  cpuBoards,
  cpuPick,
  seededRandom,
  teamTotals,
  draftStatus,
  evaluate,
  gamesMissedNow,
  marketOrder,
  recentLine,
  myPickNumbers,
  prepare,
  recommend,
  scoringTrend,
  slotForPick,
  survival,
  type ContractsFile,
  type CpuTeam,
  type Entry,
  type EspnOut,
  type InjuryInput,
  type Player,
  type PlayersFile,
  type Settings,
} from "./engine";

const data = JSON.parse(
  readFileSync(new URL("../data/seed/players.json", import.meta.url), "utf8"),
) as PlayersFile;
const contracts = JSON.parse(
  readFileSync(new URL("../data/seed/contracts.json", import.meta.url), "utf8"),
) as ContractsFile;
const ctx = prepare(data, contracts.contracts);
// Most tests pin an 18-team draft (the snake math and fitted levels are checked at that size)
const settings: Settings = { ...DEFAULT_SETTINGS, teams: 18, mySlot: 5 };

test("snake order runs 1..18 then 18..1", () => {
  assert.deepEqual(
    Array.from({ length: 36 }, (_, i) => slotForPick(i, 18)),
    [
      ...Array.from({ length: 18 }, (_, i) => i + 1),
      ...Array.from({ length: 18 }, (_, i) => 18 - i),
    ],
  );
});

test("my picks from slot 1 and slot 18 hit the turns back to back", () => {
  assert.deepEqual(myPickNumbers(1, 18, 4), [0, 35, 36, 71]);
  assert.deepEqual(myPickNumbers(18, 18, 4), [17, 18, 53, 54]);
  for (const n of myPickNumbers(7, 18, 20)) assert.equal(slotForPick(n, 18), 7);
});

test("the default pool is last season's 15 teams, snaking 1..15 then 15..1", () => {
  assert.equal(DEFAULT_SETTINGS.teams, 15);
  // From slot 8 of 15: picks 8, 23, 38 (1-based), i.e. 7, 22, 37 counting from 0
  assert.deepEqual(myPickNumbers(8, 15, 10).slice(0, 3), [7, 22, 37]);
});

test("draft status knows when I'm on the clock", () => {
  const s = draftStatus(settings, new Array(4).fill({}));
  assert.equal(s.myTurn, true);
  assert.equal(s.nextMine, 4);
  assert.equal(s.afterThat, 31); // round 2, slot 5 picks 14th in the round
  assert.equal(draftStatus(settings, new Array(5).fill({})).picksUntilMine, 26);
});

test("survival falls as more picks happen and rises with market position", () => {
  // Fitted to the pool's own drafts: the next player on the list usually goes within a round,
  // a star early in the draft almost always does, a player far down the list less surely
  assert.ok(survival(0, 16) > 0.15 && survival(0, 16) < 0.4);
  assert.ok(survival(0, 16, 0, 10) < 0.15);
  assert.ok(survival(0, 16, 0, 120) > survival(0, 16, 0, 10) + 0.15);
  assert.ok(survival(30, 10) > 0.85);
  assert.ok(survival(5, 10) > survival(5, 20));
  // Someone the list has going right at your pick lasts a bit more often than not
  assert.ok(survival(16, 16) > 0.5 && survival(16, 16) < 0.8);
  // A player the pool has passed over for 20 picks tends to keep being passed over...
  assert.ok(survival(0, 16, 20, 100) > survival(0, 16, 0, 100) + 0.15);
  // ...but not a star: Quinn Hughes (18th on the list) still there at #65 won't last to #80
  assert.ok(survival(0, 15, 47, 17) < 0.3);
  assert.equal(survival(0, 0), 1);
});

test("injury notes turn into games missed", () => {
  const start = "2026-09-29";
  const p = (status: string, note: string, date = "2026-09-20T12:00Z"): InjuryInput => ({
    injury: { status, note, date },
  });
  assert.equal(gamesMissedNow(p("Out", "Terry is out another 2-3 months"), start, 84) > 25, true);
  assert.equal(gamesMissedNow(p("Out", "out for the next seven to 10 days"), start, 84), 0);
  assert.equal(gamesMissedNow(p("Day-To-Day", "day-to-day"), start, 84), 0);
  assert.equal(gamesMissedNow(p("Out", "suffered a season-ending injury"), start, 84), 84);
  assert.equal(gamesMissedNow({ espn: { status: "ACTIVE" } }, start, 84), 0);
});

test("ESPN's expected return date sets games missed and the pick card's warning", () => {
  const start = "2026-09-29";
  const out = (o: EspnOut, status = "INJURY_RESERVE"): InjuryInput => ({
    espn: { status, out: o },
  });
  // Counted against his team's schedule by the fetch; wins over the note
  const jarvis: InjuryInput = {
    ...out({ type: "Shoulder", back: "2026-10-24", season: false, games: 12 }),
  };
  jarvis.injury = {
    status: "Out",
    note: "on the ice for practice Thursday",
    date: "2026-09-25T12:00Z",
  };
  assert.equal(gamesMissedNow(jarvis, start, 84), 12);
  assert.equal(
    gamesMissedNow(out({ type: "Hip", back: "2027-07-01", season: true, games: 84 }), start, 84),
    84,
  );
  assert.equal(gamesMissedNow(out({ back: "2026-10-01", games: 0 }, "DAY_TO_DAY"), start, 84), 0);
  // An ACTIVE player is never counted hurt, whatever a stale record says
  assert.equal(gamesMissedNow(out({ back: "2026-10-24", games: 12 }, "ACTIVE"), start, 84), 0);
  // Real data: every ESPN-hurt player with a return date has a warning that names it
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const hurt = ev.list.filter((e) => e.p.espn?.out?.back && !e.p.espn.out.season);
  assert.ok(hurt.length > 0);
  for (const e of hurt) {
    assert.ok(e.hurt, e.p.name);
    assert.match(e.hurt.line, /Expected back [A-Z][a-z]{2} \d{1,2}/);
    assert.equal(e.missedNow, Math.min(e.p.espn!.out!.games!, 84));
  }
  // ...and it isn't repeated as a bullet in the pick reasons
  const rec = recommend(evaluate(ctx, settings, new Set(), new Set()), settings, [], { top: 4 });
  for (const r of rec.picks) assert.ok(!r.reasons.some((x) => /Expected back/.test(x)));
});

test("every skater gets a projection and a score", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  assert.ok(ev.list.length > 500);
  for (const e of ev.list) {
    assert.ok(Number.isFinite(e.proj) && e.proj >= 0, e.p.name);
    assert.ok(Number.isFinite(e.score), e.p.name);
  }
  // The best players in hockey should be near the top
  const top10 = ev.list.slice(0, 10).map((e) => e.p.name);
  assert.ok(top10.includes("Connor McDavid"));
});

test("market order puts ESPN ADP first", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const m = marketOrder(ev.list, "espn");
  assert.ok(m[0]!.p.espn!.adp! <= m[1]!.p.espn!.adp!);
  const pts = marketOrder(ev.list, "points");
  assert.ok((pts[0]!.p.lastRow?.pts ?? 0) >= (pts[1]!.p.lastRow?.pts ?? 0));
});

test("the pool drafts off last season's points or the projection if higher, hurt players lower", () => {
  assert.equal(DEFAULT_SETTINGS.market, "pool");
  const [a, b] = evaluate(ctx, settings, new Set(), new Set()).list as [Entry, Entry];
  const hurt = { ...a, id: -1, p: { ...a.p, lastRow: { pts: 80 } }, healthy: 0.5 };
  const well = { ...b, id: -2, p: { ...b.p, lastRow: { pts: 50 } }, healthy: 1 };
  assert.deepEqual(
    marketOrder([hurt, well], "points").map((e) => e.id),
    [-2, -1],
  );
  assert.deepEqual(
    marketOrder([{ ...hurt, healthy: 1 }, well], "points").map((e) => e.id),
    [-1, -2],
  );
  // A star coming off a short season goes on his projection; a steady scorer on what he scored
  const star = {
    ...a,
    id: -3,
    p: { ...a.p, lastRow: { pts: 30 } },
    espn: 85,
    proj: 85,
    healthy: 1,
  };
  const steady = {
    ...b,
    id: -4,
    p: { ...b.p, lastRow: { pts: 70 } },
    espn: 60,
    proj: 60,
    healthy: 1,
  };
  assert.deepEqual(
    marketOrder([steady, star], "pool").map((e) => e.id),
    [-3, -4],
  );
  assert.deepEqual(
    marketOrder([steady, star], "points").map((e) => e.id),
    [-4, -3],
  );
});

test("projected-points market follows ESPN's projection, not ADP", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const m = marketOrder(ev.list, "proj");
  const pts = (e: Entry) => e.espn ?? e.proj;
  for (let i = 1; i < 200; i++) assert.ok(pts(m[i - 1]!) >= pts(m[i]!), `out of order at ${i}`);
  // Defencemen ESPN leagues draft early for their other stats drop down this list
  const byAdp = marketOrder(ev.list, "espn");
  const dTop = (list: Entry[]) => list.slice(0, 60).filter((e) => e.p.pos === "D").length;
  assert.ok(dTop(m) < dTop(byAdp), `D in top 60: proj ${dTop(m)} vs ADP ${dTop(byAdp)}`);
});

test("pick reasons show the last three seasons' points per game, and no ADP", () => {
  const ev0 = evaluate(ctx, settings, new Set(), new Set());
  const taken = ev0.list.slice(0, 4).map((e) => ({ playerId: e.id }));
  const ev = evaluate(ctx, settings, new Set(taken.map((t) => t.playerId)), new Set());
  const rec = recommend(ev, settings, taken);
  for (const r of rec.picks) {
    const line = r.reasons.find((x) => x.startsWith("Points per game "));
    assert.ok(line, `${r.e.p.name}: ${r.reasons.join(" | ")}`);
    assert.match(line, /^Points per game \d\.\d\d.* \((\d\d-\d\d to )?25-26\)/);
    assert.ok(!r.reasons.some((x) => x.includes("ADP")));
    // Alternatives show four lines, so the odds of lasting to my next pick come second
    assert.match(r.reasons[1]!, /\d+%.*#32/, `${r.e.p.name}: ${r.reasons[1]}`);
  }
});

test("the points-per-game line compares last season with the two before", () => {
  const mk = (rows: [number, number, number][]) =>
    prepare(
      {
        ...ctx,
        seasons: [20212022, 20222023, 20232024, 20242025, 20252026],
        teams: { TBL: {} },
        players: [
          {
            id: 1,
            name: "P",
            pos: "C",
            team: "TBL",
            age: 28,
            careerGP: 400,
            mates: [],
            hist: rows.map(([season, gp, pts]) => [season, "TBL", gp, 0, pts, pts, 0, 1100]),
          },
        ],
      },
      [],
    ).byId.get(1)!;
  const slump = mk([
    [20232024, 80, 88],
    [20242025, 81, 88],
    [20252026, 63, 50],
  ]);
  assert.equal(
    recentLine(slump),
    "Points per game 1.10 → 1.09 → 0.79 (23-24 to 25-26): last season down 27% on the two before",
  );
  const flat = mk([
    [20232024, 80, 60],
    [20242025, 80, 61],
    [20252026, 80, 61],
  ]);
  assert.match(recentLine(flat)!, /about level with the two before$/);
  // A season he missed entirely, and a short one, read as such
  const gap = mk([
    [20232024, 80, 70],
    [20252026, 12, 10],
  ]);
  assert.equal(
    recentLine(gap),
    "Points per game 0.88 → no NHL games → 0.83 (12 GP) (23-24 to 25-26): last season down 5% on 23-24",
  );
  // A rookie with one season has no comparison
  assert.equal(recentLine(mk([[20252026, 70, 40]])), "Points per game 0.57 (25-26)");
});

test("value tags name the list the pool drafts from", () => {
  for (const [market, word] of [
    ["espn", "ESPN ADP"],
    ["proj", "projected points"],
    ["points", "last season"],
    ["pool", "ESPN's projection if higher"],
  ] as const) {
    const ev = evaluate(ctx, { ...settings, market }, new Set(), new Set());
    const tags = ev.list.flatMap((e) => e.tags.filter((t) => t.k === "value"));
    assert.ok(tags.length > 0, `no value tags for ${market}`);
    assert.ok(
      tags.every((t) => t.d.includes(word)),
      `${market}: ${tags.find((t) => !t.d.includes(word))?.d}`,
    );
  }
});

test("stacking bonus applies to a linemate of my player", () => {
  const mcd = ctx.players.find((p) => p.name === "Connor McDavid")!;
  const mateId = mcd.mates[0]![0];
  const without = evaluate(ctx, settings, new Set([mcd.id]), new Set()).byId.get(mateId)!;
  const withMe = evaluate(ctx, settings, new Set([mcd.id]), new Set([mcd.id])).byId.get(mateId)!;
  assert.ok(withMe.score > without.score);
  assert.ok(withMe.tags.some((t) => t.k === "stack"));
});

test("recommendation gives three different available players on my turn", () => {
  const ev0 = evaluate(ctx, settings, new Set(), new Set());
  const taken = ev0.list.slice(0, 4).map((e) => ({ playerId: e.id }));
  const takenIds = new Set(taken.map((t) => t.playerId));
  const ev = evaluate(ctx, settings, takenIds, new Set());
  const rec = recommend(ev, settings, taken);
  assert.equal(rec.status.myTurn, true);
  assert.equal(rec.picks.length, 3);
  const ids = rec.picks.map((r) => r.e.id);
  assert.equal(new Set(ids).size, 3);
  for (const id of ids) assert.ok(!takenIds.has(id));
  assert.ok(rec.picks.every((r) => r.reasons.length > 0));
});

test("the app's pick card gets the pick plus three alternatives", () => {
  const ev0 = evaluate(ctx, settings, new Set(), new Set());
  const taken = ev0.list.slice(0, 4).map((e) => ({ playerId: e.id }));
  const ev = evaluate(ctx, settings, new Set(taken.map((t) => t.playerId)), new Set());
  const rec = recommend(ev, settings, taken, { top: 4 });
  assert.equal(rec.picks.length, 4);
  assert.equal(new Set(rec.picks.map((r) => r.e.id)).size, 4);
  // Best expected value first
  for (let i = 1; i < 4; i++) assert.ok(rec.picks[i - 1]!.ev >= rec.picks[i]!.ev);
});

test("the last two rounds add a take-a-chance pick with real upside", () => {
  const s = { ...settings, mySlot: 14 };
  const ev0 = evaluate(ctx, s, new Set(), new Set());
  // What a redraft pickup is worth sits around the end of a 180-player draft
  const byProj = [...ev0.list].sort((a, b) => b.proj - a.proj);
  assert.ok(ev0.redraftLevel > byProj[199]!.proj && ev0.redraftLevel < byProj[119]!.proj);
  const mine = myPickNumbers(14, 18, 10);
  const at = (round: number, extra: Partial<Settings> = {}) => {
    const n = mine[round - 1];
    const picks = ev0.list.slice(0, n).map((e) => ({ id: e.id }));
    const ev = evaluate(ctx, { ...s, ...extra }, new Set(picks.map((p) => p.id)), new Set());
    return { ev, rec: recommend(ev, { ...s, ...extra }, picks, { top: 4 }) };
  };
  assert.equal(at(8).rec.chance, null);
  for (const round of [9, 10]) {
    const { ev, rec } = at(round);
    const c = rec.chance;
    assert.ok(c, `no chance pick in round ${round}`);
    assert.ok(!rec.picks.some((r) => r.e.id === c.e.id));
    assert.ok(c.e.p.upside >= 0.28 && c.e.ceiling > ev.redraftLevel);
    assert.match(c.reasons[1]!, /^Take a chance: in a good year/);
  }
  assert.equal(at(10, { redraftDrops: 0 }).rec.chance, null);
  assert.ok(at(8, { redraftDrops: 3 }).rec.chance);
});

test("recommendation still works on my very last pick", () => {
  const s = { ...settings, rounds: 2 };
  const picks = new Array(31).fill({ playerId: -1 }); // my 2nd-round pick is #32 (index 31)
  const ev = evaluate(ctx, s, new Set(), new Set());
  const rec = recommend(ev, s, picks);
  assert.equal(rec.status.myTurn, true);
  assert.equal(rec.between, null);
  assert.equal(rec.picks[0]!.e.id, ev.list[0]!.id); // nothing to wait for: best score
});

test("big contracts from contracts.json are flagged", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const flagged = ev.list.filter((e) => e.tags.some((t) => t.k === "contract"));
  assert.ok(flagged.length >= 5, `only ${flagged.length} contracts matched`);
});

// hist rows as prepare() builds them: back = seasons before last season
const row = (back: number, gp: number, pts: number, toi = 1100) => ({
  season: 20252026 - back * 10001,
  back,
  gp,
  pts,
  toi,
});

test("a steady rise in points per game reads as rising", () => {
  const t = scoringTrend([
    row(4, 80, 40),
    row(3, 82, 50),
    row(2, 78, 58),
    row(1, 80, 68),
    row(0, 82, 80),
  ])!;
  assert.equal(t.dir, 1);
  assert.equal(t.run, 4);
  assert.ok(t.rel > 0.1);
});

test("a steady fall reads as declining, noise and short histories don't", () => {
  const down = scoringTrend([row(3, 80, 90), row(2, 82, 80), row(1, 78, 66), row(0, 80, 55)])!;
  assert.equal(down.dir, -1);
  const flat = scoringTrend([row(3, 80, 60), row(2, 82, 63), row(1, 78, 58), row(0, 80, 61)])!;
  assert.equal(flat.dir, 0);
  assert.equal(scoringTrend([row(1, 80, 60), row(0, 82, 80)]), null);
});

test("one bad season after a steady run is a bounce-back, not a decline", () => {
  const t = scoringTrend([row(2, 80, 80), row(1, 82, 82), row(0, 80, 50)], "slumped")!;
  assert.equal(t.dir, 0);
});

test("injury-prone needs a pattern, and a fully missed season counts as zero games", () => {
  const mk = (id: number, hist: [number, number][]): Player => ({
    id,
    name: `P${id}`,
    pos: "C",
    team: "EDM",
    age: 29,
    careerGP: null,
    mates: [],
    hist: hist.map(([season, gp]) => [season, "EDM", gp, 10, 20, 30, 5, 1100]),
  });
  const data = {
    ...ctx,
    seasons: [20212022, 20222023, 20232024, 20242025, 20252026],
    teams: { EDM: {} },
    players: [
      mk(1, [
        [20212022, 60],
        [20222023, 55],
        [20232024, 81],
        [20242025, 58],
        [20252026, 80],
      ]),
      mk(2, [
        [20212022, 82],
        [20222023, 13],
        [20232024, 80],
        [20242025, 81],
        [20252026, 79],
      ]),
      mk(3, [
        [20212022, 70],
        [20222023, 68],
        [20232024, 72],
        [20242025, 67],
      ]),
    ],
  };
  const c = prepare(data, []);
  assert.ok(c.byId.get(1)!.injuryProne, "three seasons of 20+ missed");
  assert.equal(c.byId.get(2)!.injuryProne, null, "one long injury only");
  const p3 = c.byId.get(3)!;
  assert.ok(p3.injuryProne, "missed the whole last season");
  assert.match(p3.injuryProne.gpLine, /25-26: 0/);
});

test("rising, declining and injury-prone flags show up on real players and move the score", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const top = ev.list.slice(0, 250);
  for (const k of ["rising", "declining", "injury"]) {
    assert.ok(
      top.some((e) => e.tags.some((t) => t.k === k)),
      `no ${k} tags`,
    );
  }
  const noTrend = evaluate(
    ctx,
    { ...settings, weights: { ...settings.weights, trend: 0, injuryProne: 0 } },
    new Set(),
    new Set(),
  );
  const riser = top.find((e) => e.tags.some((t) => t.k === "rising"))!;
  const prone = top.find(
    (e) => e.tags.some((t) => t.k === "injury") && !e.tags.some((t) => t.k === "rising"),
  )!;
  assert.ok(riser.score > noTrend.byId.get(riser.id)!.score);
  assert.ok(prone.score < noTrend.byId.get(prone.id)!.score);
});

test("a full mock draft with computer teams finishes with every pick unique", () => {
  let seed = 42;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const s = { ...settings, mySlot: 7 };
  const ev = evaluate(ctx, s, new Set(), new Set());
  const orders = { espn: marketOrder(ev.list, "espn"), points: marketOrder(ev.list, "points") };
  const picks: { id: number }[] = [];
  const taken = new Set<number>();
  const total = s.teams * s.rounds;
  while (picks.length < total) {
    const slot = slotForPick(picks.length, s.teams);
    let id: number | null;
    if (slot === s.mySlot) {
      const ev2 = evaluate(ctx, s, taken, new Set());
      id = recommend(ev2, s, picks).picks[0]!.e.id;
    } else {
      id = cpuPick(slot % 3 ? orders.espn : orders.points, taken, 1, rng);
    }
    assert.ok(id != null && !taken.has(id));
    taken.add(id);
    picks.push({ id });
  }
  assert.equal(new Set(picks.map((p) => p.id)).size, total);
  const table = teamTotals(evaluate(ctx, s, taken, new Set()), s, picks);
  assert.equal(table.length, 18);
  assert.ok(table.every((t) => t.players.length === s.rounds));
  assert.ok(table[0]!.total >= table[17]!.total);
  // Following the app's recommendations should beat the average computer team
  const mine = table.find((t) => t.slot === 7)!;
  const avg = table.reduce((a, t) => a + t.total, 0) / table.length;
  assert.ok(mine.total > avg, `mine ${mine.total} vs average ${avg}`);
});

test("computer teams stray from the list about as much as the pool does, stars excepted", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const orders = {
    pool: marketOrder(ev.list, "pool"),
    points: marketOrder(ev.list, "points"),
    proj: marketOrder(ev.list, "proj"),
  };
  const cpu: Record<string, CpuTeam> = Object.fromEntries(
    Array.from({ length: 18 }, (_, i): [number, CpuTeam] => [i + 1, { style: "pool", noise: 1 }]),
  );
  cpu[4]!.lean = { D: 0.4 }; // a team that loves defencemen
  const a = cpuBoards(orders, cpu, seededRandom(9));
  const b = cpuBoards(orders, cpu, seededRandom(9));
  assert.deepEqual(
    a[3]!.slice(0, 40).map((e) => e.id),
    b[3]!.slice(0, 40).map((e) => e.id),
  );
  // Over ten mocks, the team that leans to defencemen has more of them near the top of its board
  const dShare = (board: Entry[]) => board.slice(0, 40).filter((e) => e.p.pos === "D").length;
  let leanD = 0;
  let plainD = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const bs = cpuBoards(orders, cpu, seededRandom(100 + seed));
    leanD += dShare(bs[4]!);
    plainD += dShare(bs[5]!);
  }
  assert.ok(leanD > plainD, `D ${leanD} vs ${plainD}`);
  // Draft 180 picks, each team taking the top of its own board, over a few mocks
  const rank = new Map(orders.pool.map((e, i): [number, number] => [e.id, i]));
  let inTop = 0;
  let starsLate = 0;
  let early = 0;
  let late = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const boards = cpuBoards(orders, cpu, seededRandom(seed));
    const taken = new Map<number, number>();
    for (let i = 0; i < 180; i++) {
      const id = boards[slotForPick(i, 18)]!.find((e) => !taken.has(e.id))!.id;
      taken.set(id, i);
      if (i < 60) early += rank.get(id)! / 300;
      if (i >= 120) late += rank.get(id)! / 300;
    }
    inTop += [...taken.keys()].filter((id) => rank.get(id)! < 180).length / 900;
    // The pool has never left one of its top 30 undrafted, and only once let one slide 40 picks
    starsLate += orders.pool
      .slice(0, 30)
      .filter((e) => !taken.has(e.id) || taken.get(e.id)! > rank.get(e.id)! + 40).length;
  }
  // The pool's drafts put 73-81% of the list's top 150-170 on a team; a straight list would be 100%
  assert.ok(inTop > 0.7 && inTop < 0.9, `inTop ${inTop}`);
  assert.ok(starsLate <= 2, `stars slid ${starsLate} times in 5 mocks`);
  // ...but still broadly in list order
  assert.ok(early < late / 2, `early ${early} late ${late}`);
});

test("computer picks come from the top of the board and skip drafted players", () => {
  const ev = evaluate(ctx, settings, new Set(), new Set());
  const order = marketOrder(ev.list, "espn");
  const taken = new Set([order[0]!.id, order[1]!.id]);
  for (let i = 0; i < 50; i++) {
    const id = cpuPick(order, taken, 1);
    assert.ok(!taken.has(id!));
    assert.ok(order.findIndex((e) => e.id === id) < 10);
  }
});
