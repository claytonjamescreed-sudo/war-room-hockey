// Every published version of the site, newest first, written for the pool (it's the "What's new"
// page). Each release bumps "version" in package.json to match the entry at the top, following
// Semantic Versioning: a fix is 1.0.1, a new feature 1.1.0, a big overhaul 2.0.0. Checked in
// src/lib/release.test.ts.

export type ChangeKind = "new" | "improved" | "fixed";
export type Release = {
  version: string;
  date: string; // YYYY-MM-DD, Pacific time
  title: string;
  changes: { kind: ChangeKind; text: string }[];
};

export const CHANGELOG: Release[] = [
  {
    version: "1.1.0",
    date: "2026-09-30",
    title: "A proper phone menu",
    changes: [
      {
        kind: "improved",
        text: "On phones, the menu opens from the ☰ button at the top: every page in one list, no swiping, with the light/dark switch at the bottom.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-30",
    title: "Opening night",
    changes: [
      {
        kind: "new",
        text: "Standings with live points during games, last night, the last 7 days and each team's projected finish.",
      },
      {
        kind: "new",
        text: "Tonight: every game with live scores, and each pool player's goals and assists as they happen. Start times in Pacific time.",
      },
      {
        kind: "new",
        text: "The recap: last night in the pool, called like a hockey announcer would.",
      },
      { kind: "new", text: "The race chart of the season, and the pool's top scorers in Leaders." },
      { kind: "new", text: "Swaps & Rules: how the pool is scored, and every All-Star swap." },
      {
        kind: "new",
        text: "History: the champions' banners, the records and the top 3 of every pool since 2020-21.",
      },
      {
        kind: "new",
        text: "Team lockers: this season's roster and every past season for each team, with a badge for every team. Former teams have their own section.",
      },
      { kind: "new", text: "The TV board for draft night." },
      {
        kind: "new",
        text: "Get the app: save War Room to your phone's home screen and open it like an app.",
      },
      {
        kind: "new",
        text: "An Update now button appears when a new version is published, and this What's new page lists every version.",
      },
    ],
  },
];
