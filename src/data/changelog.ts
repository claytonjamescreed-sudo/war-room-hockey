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
    version: "1.10.0",
    date: "2026-10-19",
    title: "Points back on the race",
    changes: [
      {
        kind: "new",
        text: "The Race has a Points back view: how far every team was behind the leader on each game day, with the leader along the top.",
      },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-10-19",
    title: "The race, by place",
    changes: [
      {
        kind: "new",
        text: "The Race is now one chart of every team's place in the pool, game day by game day, with each team's name and place at the end of its line. Switch to Points to see the totals instead.",
      },
      {
        kind: "new",
        text: "Tap up to 3 teams to pick them out in colour; the top 3 are picked to start. Hover or tap the chart for each picked team's place and points that day.",
      },
      {
        kind: "new",
        text: "Under the chart, today's standings with each team's best and worst place of the season.",
      },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-10-15",
    title: "Last night for every player",
    changes: [
      {
        kind: "new",
        text: "Each team's player list has a Last night column: every player's points from the last game day, in the standings and the team lockers.",
      },
      {
        kind: "fixed",
        text: 'The recap now tells the standings as last night\'s result ("climbed to 3rd", "led by 4"). It used to read as where teams stand now, which didn\'t match the standings while tonight\'s games moved them, or overnight before the morning update.',
      },
      {
        kind: "fixed",
        text: '"An 11-point cushion", not "a 11-point cushion".',
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-10-14",
    title: "A recap that doesn't repeat itself",
    changes: [
      {
        kind: "new",
        text: "Tom Larscheid joins the booth, so the recap now rotates through five Vancouver voices: John Shorthouse, John Garrett, Jim Robson, Don Taylor and Tommy.",
      },
      {
        kind: "improved",
        text: "Each booth has 40 sayings, 16 ways to open and 17 to sign off, and the recap goes through every one before any comes back: a booth's sayings last the whole season. The rest of the recap has far more ways to say each thing too.",
      },
      {
        kind: "improved",
        text: "A recap no longer tells the same joke twice in one morning.",
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-10-08",
    title: "The recap gets a broadcast booth",
    changes: [
      {
        kind: "new",
        text: "Each morning's recap is called from a different Vancouver booth, in turn: John Shorthouse, John Garrett, Jim Robson and Don Taylor, with some of their best-known lines. No two days in a row sound alike.",
      },
      {
        kind: "new",
        text: "New in the recap: three stars of the night, the week's hottest team, the injury ward, and a tip of the cap to a day-to-day player who played anyway.",
      },
    ],
  },
  {
    version: "1.5.5",
    date: "2026-10-05",
    title: "Every scorer shows on phones",
    changes: [
      {
        kind: "fixed",
        text: "When exactly 6 pool players scored, phones showed only 5 of them with no way to see the sixth.",
      },
    ],
  },
  {
    version: "1.5.4",
    date: "2026-10-02",
    title: "A shorter scorers list",
    changes: [
      {
        kind: "improved",
        text: "The scorers list under the standings shows the top 5 from the last game day, with a button to show them all. After a full night it ran to dozens of names.",
      },
    ],
  },
  {
    version: "1.5.3",
    date: "2026-10-01",
    title: "Sign-in emails from the pool",
    changes: [
      {
        kind: "improved",
        text: "The commissioner's sign-in email now comes from the pool's own address, in the site's gold and black.",
      },
    ],
  },
  {
    version: "1.5.2",
    date: "2026-10-01",
    title: "The site updates itself",
    changes: [
      {
        kind: "improved",
        text: "When a new version is out, the site now updates itself as you open it or come back to it, with nothing to tap. Update now only appears if a new version comes out while you're looking at the page.",
      },
      {
        kind: "improved",
        text: "On phones, Update now is a bar across the top of the page instead of a button in the bottom corner.",
      },
      {
        kind: "improved",
        text: "Pool goals tonight is tidier: the team that gets the point is in yellow beside its player, and the running-total badges are gone.",
      },
    ],
  },
  {
    version: "1.5.1",
    date: "2026-10-01",
    title: "Games played means games finished",
    changes: [
      {
        kind: "improved",
        text: "A game now counts in GP once it's over, not from puck drop, and games left drops at the same time. Points per game counts finished games too: tonight's points still show live, and join PPG at the final horn.",
      },
    ],
  },
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
