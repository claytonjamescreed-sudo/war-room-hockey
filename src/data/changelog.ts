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
    version: "1.5.0",
    date: "2026-10-01",
    title: "A Tonight card that stays short on a busy night",
    changes: [
      {
        kind: "improved",
        text: "Pool goals tonight shows the latest 5, with a button to show them all. On a full night there can be 50 or more, which pushed the standings a long way down the page.",
      },
      {
        kind: "improved",
        text: "On phones, tonight's games are one row you swipe through, with the games on now first.",
      },
    ],
  },
  {
    version: "1.4.2",
    date: "2026-10-01",
    title: "TV board, by the commissioner",
    changes: [
      {
        kind: "improved",
        text: "The TV board link is gone from the bottom of the page. The commissioner opens it from the Commissioner page or the draft room.",
      },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-10-01",
    title: "wghockeypool.com",
    changes: [
      {
        kind: "improved",
        text: "The pool has its own address: wghockeypool.com. The old address forwards there, and the morning update goes straight to the new one.",
      },
      {
        kind: "fixed",
        text: 'A page left open while the site was updated could show "This page didn\'t load" when you tapped to another page. It now reloads itself onto the newest version, and Try again does the same.',
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-01",
    title: "Injuries count in the projections",
    changes: [
      {
        kind: "improved",
        text: "Projections account for injuries: a player on the injury report isn't credited with the games he's expected to miss before his return date. His injury line says how many.",
      },
      {
        kind: "improved",
        text: "A player's scoring rate is his points per game played, so a game he sat out no longer drags his projection down.",
      },
      {
        kind: "improved",
        text: "The standings fit a phone without scrolling sideways: rank, team and points, with the other numbers under each team's name.",
      },
    ],
  },
  {
    version: "1.3.2",
    date: "2026-10-01",
    title: "Sharper tab icon",
    changes: [
      {
        kind: "improved",
        text: "The browser tab icon is now a clean square version of the pool's logo, so it looks sharp everywhere.",
      },
    ],
  },
  {
    version: "1.3.1",
    date: "2026-10-01",
    title: "A logo of our own",
    changes: [
      {
        kind: "improved",
        text: "The pool has a logo: a skate in full stride with speed stripes, in black, gold and red. It's in the header, the browser tab and the home-screen icon. If you saved the site to your home screen, remove it and add it again to get the new icon.",
      },
      {
        kind: "fixed",
        text: "On wide screens the header no longer breaks the site's name onto two lines: the menu sits on its own row.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-01",
    title: "Injuries and next games",
    changes: [
      {
        kind: "new",
        text: "Injuries: a player on the injury report gets a badge by his name (IR, OUT, DTD for day-to-day, or SUSP), with the injury and when he's expected back. From ESPN's injury report.",
      },
      {
        kind: "new",
        text: "Next game for every player: shown when he isn't playing tonight, and as a column in the team lockers.",
      },
      {
        kind: "improved",
        text: 'The Tonight count leaves out players who are out, and says how many: "1 playing · 3 out".',
      },
      {
        kind: "improved",
        text: "A new home-screen icon for WG Hockey Pool.",
      },
    ],
  },
  {
    version: "1.2.1",
    date: "2026-10-01",
    title: "A new address",
    changes: [
      {
        kind: "fixed",
        text: "The site now lives at wg-hockey-pool.lovable.app, and the morning update follows it there. If you saved the old site to your home screen, add it again from the new address.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-01",
    title: "Man games and points per game",
    changes: [
      {
        kind: "new",
        text: "Man games for every team and every player: games played, games missed (injuries, scratches, rest) and games left. Team totals are in the standings on wide screens; tap a team open to see them for each of its players.",
      },
      {
        kind: "new",
        text: "Projected points for every player. On wide screens an opened team's players line up under the same columns as the teams.",
      },
      {
        kind: "new",
        text: "Points per game for every player, and for every team.",
      },
      {
        kind: "improved",
        text: "The Tonight column shows how many of each team's players are playing, then who's live and who's still to play.",
      },
      {
        kind: "improved",
        text: "Pool goals tonight reads cleanly on phones: the time and score, the play, then who it counted for. Only the pool's players are in bold.",
      },
      {
        kind: "fixed",
        text: "The top bar on phones fits on one row again with the site's new name. Get the app is in the menu too.",
      },
    ],
  },
  {
    version: "1.1.3",
    date: "2026-10-01",
    title: "WG Hockey Pool",
    changes: [{ kind: "improved", text: "The site is now called WG Hockey Pool." }],
  },
  {
    version: "1.1.2",
    date: "2026-10-01",
    title: "Tonight means tonight",
    changes: [
      {
        kind: "fixed",
        text: "In the morning, Tonight showed last night's finished games and goals until about 9 AM Pacific. It now switches to the day's games at 3 AM Pacific; last night stays in the recap.",
      },
    ],
  },
  {
    version: "1.1.1",
    date: "2026-09-30",
    title: "Menu, labelled",
    changes: [
      {
        kind: "improved",
        text: "The ☰ button on phones now says Menu, so it's easy to spot.",
      },
    ],
  },
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
