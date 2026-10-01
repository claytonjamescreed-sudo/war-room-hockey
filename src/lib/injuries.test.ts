import { describe, expect, it } from "vitest";
import {
  gamesOut,
  isOut,
  kindOf,
  matchInjuries,
  nhlTeam,
  plainName,
  type Injury,
  type ReportLine,
} from "./injuries";

const line = (
  name: string,
  team: string,
  pos: string,
  status: string,
  detail: string | null = "Upper Body",
): ReportLine => {
  const [first, ...rest] = name.split(" ");
  return {
    name,
    first: first!,
    last: rest.join(" "),
    team,
    pos,
    status,
    detail,
    returnDate: "2026-10-05",
    note: null,
  };
};
const player = (id: number, name: string, team: string, pos = "C") => ({ id, name, team, pos });

describe("injuries", () => {
  it("compares names without accents, dots or spaces", () => {
    expect(plainName("Tim Stützle")).toBe("timstutzle");
    expect(plainName("Juraj Slafkovský")).toBe("jurajslafkovsky");
    expect(plainName("J.T. Miller")).toBe("jtmiller");
    expect(plainName("Ryan O'Reilly")).toBe("ryanoreilly");
  });

  it("reads ESPN's statuses and team codes", () => {
    expect(kindOf("Injured Reserve")).toBe("ir");
    expect(kindOf("Out")).toBe("out");
    expect(kindOf("Day-To-Day")).toBe("dtd");
    expect(kindOf("Suspension")).toBe("susp");
    expect(kindOf("Questionable")).toBe("dtd");
    expect(nhlTeam("TB")).toBe("TBL");
    expect(nhlTeam("LA")).toBe("LAK");
    expect(nhlTeam("EDM")).toBe("EDM");
    expect(nhlTeam(null)).toBeNull();
  });

  it("matches a player by name, accents or not", () => {
    const got = matchInjuries(
      [
        player(1, "Bryan Rust", "PIT", "R"),
        player(2, "Tim Stützle", "OTT"),
        player(3, "Sidney Crosby", "PIT"),
      ],
      [
        line("Bryan Rust", "PIT", "RW", "Injured Reserve"),
        line("Tim Stutzle", "OTT", "C", "Day-To-Day", "Lower Body"),
        line("Somebody Else", "PIT", "D", "Out"),
      ],
    );
    expect(got[1]).toEqual({
      kind: "ir",
      label: "IR",
      status: "Injured Reserve",
      detail: "Upper Body",
      returnDate: "2026-10-05",
      note: null,
    });
    expect(got[2]).toMatchObject({ kind: "dtd", label: "DTD", detail: "Lower Body" });
    expect(got[3]).toBeUndefined();
    expect(isOut(got[1])).toBe(true);
    expect(isOut(got[2])).toBe(false);
    expect(isOut(got[3])).toBe(false);
  });

  it("matches a nickname or a shortened name on the same team", () => {
    const got = matchInjuries(
      [
        player(1, "John-Jason Peterka", "BOS", "R"),
        player(2, "Mats Zuccarello Aasen", "LAK", "R"),
        player(3, "Nikita Kucherov", "TBL", "R"),
      ],
      [
        line("JJ Peterka", "BOS", "RW", "Out"),
        line("Mats Zuccarello", "LA", "RW", "Day-To-Day"),
        // The same last name on another team is somebody else
        line("Nick Kucherov", "FLA", "RW", "Out"),
      ],
    );
    expect(got[1]).toMatchObject({ label: "OUT" });
    expect(got[2]).toMatchObject({ label: "DTD" });
    expect(got[3]).toBeUndefined();
  });

  it("doesn't mistake a player for another of the same name", () => {
    // The Sebastian Aho who is hurt is a defenceman in Pittsburgh; ours is Carolina's centre. And
    // Vancouver has two Elias Petterssons: the defenceman is out, the centre is day-to-day.
    const report = [
      line("Sebastian Aho", "PIT", "D", "Injured Reserve"),
      line("Elias Pettersson", "VAN", "D", "Out"),
    ];
    const ours = [
      player(1, "Sebastian Aho", "CAR", "C"),
      player(2, "Elias Pettersson", "VAN", "C"),
    ];
    expect(matchInjuries(ours, report)).toEqual({});
    expect(
      matchInjuries(ours, [...report, line("Elias Pettersson", "VAN", "C", "Day-To-Day")])[2],
    ).toMatchObject({ label: "DTD" });

    // With both Petterssons in the pool, each gets his own line
    const both = matchInjuries(
      [player(2, "Elias Pettersson", "VAN", "C"), player(3, "Elias Pettersson", "VAN", "D")],
      report,
    );
    expect(both[2]).toBeUndefined();
    expect(both[3]).toMatchObject({ label: "OUT" });

    // Two of ours who can't be told apart: neither is marked
    expect(
      matchInjuries(
        [player(4, "Elias Pettersson", "VAN", "D"), player(5, "Elias Pettersson", "VAN", "D")],
        report,
      ),
    ).toEqual({});
  });

  it("leaves a player unmarked when the team doesn't agree", () => {
    // Traded, and our game logs still have his old team: no badge rather than a wrong one
    expect(
      matchInjuries(
        [player(1, "Bryan Rust", "PIT", "R")],
        [line("Bryan Rust", "NYR", "RW", "Out")],
      ),
    ).toEqual({});
    // A swapped-in player we have no team for yet is matched on his name and position
    expect(
      matchInjuries(
        [{ id: 1, name: "Bryan Rust", team: null, pos: "R" }],
        [line("Bryan Rust", "NYR", "RW", "Out")],
      )[1],
    ).toMatchObject({ label: "OUT" });
  });

  it("counts the games a player is expected to miss before he's back", () => {
    const out = (returnDate: string | null): Injury => ({
      kind: "ir",
      label: "IR",
      status: "Injured Reserve",
      detail: null,
      returnDate,
      note: null,
    });
    const g = (state: string, away: string, home: string) => ({ state, away, home });
    const week = [
      { date: "2026-10-01", games: [g("OFF", "EDM", "TOR")] },
      { date: "2026-10-02", games: [g("LIVE", "TOR", "EDM"), g("FUT", "MTL", "BOS")] },
      { date: "2026-10-04", games: [g("FUT", "EDM", "CGY")] },
      { date: "2026-10-06", games: [g("FUT", "MTL", "EDM")] },
    ];
    // Healthy, or with no return date, or already due back: none
    expect(gamesOut(undefined, "EDM", week, "2026-10-02")).toBe(0);
    expect(gamesOut(out(null), "EDM", week, "2026-10-02")).toBe(0);
    expect(gamesOut(out("2026-10-02"), "EDM", week, "2026-10-02")).toBe(0);
    // Tonight's game (on now) and the 4th; a game already over isn't one to come
    expect(gamesOut(out("2026-10-05"), "EDM", week, "2026-10-02")).toBe(2);
    expect(gamesOut(out("2026-10-05"), "EDM", week, "2026-10-01")).toBe(2);
    // Only his own team's games
    expect(gamesOut(out("2026-10-05"), "BOS", week, "2026-10-02")).toBe(1);
    // Past the schedule: the 3 counted, then 30 days at the league's pace (about 13)
    expect(gamesOut(out("2026-11-06"), "EDM", week, "2026-10-02")).toBe(16);
    // No schedule at all: estimated from today
    expect(gamesOut(out("2026-10-16"), "EDM", [], "2026-10-02")).toBe(6);
    expect(gamesOut(out("2026-10-05"), null, week, "2026-10-02")).toBe(0);
  });

  it("has nobody hurt when the report is empty", () => {
    expect(matchInjuries([player(1, "Bryan Rust", "PIT")], [])).toEqual({});
  });
});
