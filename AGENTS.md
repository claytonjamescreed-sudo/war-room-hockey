<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- Season scoring lives in `src/lib/season.ts`, a behaviour-exact port of season.js; change only with tests in `season.test.ts`. Why: numbers must match OfficePools.
- Game logs are synced from NHL.com into `player_games` by `/api/public/cron/sync`; pages read the DB, never fetch 150 logs per request. Why: Worker subrequest limits and speed.
- The morning sync runs from pg_cron (`war-room-sync-a` 12:45 UTC, `war-room-sync-b` 12:50 UTC, half the players each). The jobs sign with a key the database generated in the vault (`war_room_sync_token`, checked by `sync_token_ok()`, service role only); the route also accepts `LOVABLE_CRON_SECRET`. The jobs call the site by its published address (`wg-hockey-pool.lovable.app`, migration 0005): if that address ever changes, reschedule both jobs in a new migration the same day, or the next morning's sync hits a 404. Why: nobody has to copy a secret into SQL.
- `sync` also rewrites `daily_totals` for every date since count_from. Why: movement arrows and race chart come from saved totals.
- Projections/ESPN/injury/linemate data live only in `player_model`/`model_meta` (admin-only RLS); public `players` has safe columns. Why: War Room strategy must never reach public pages.
- Seed JSON lives in `src/data/seed/` and is imported only from `*.server.ts`. Why: keep private model data out of client bundles.
- Admin role is granted by `claim_admin()` for emails in `admin_emails`. Why: roles in a separate table, no client-side checks.
- Live points come from `src/lib/live.ts` (pure, tested in `live.test.ts`) on NHL.com's score feed: synced points before tonight + feed points for games not yet in `player_games` (matched by game id) + tonight. Shootout goals never count. Why: live totals must equal the synced totals once the morning sync runs.
- Commissioner writes go through `src/lib/admin.functions.ts`: `requireCommissioner` checks `has_role` first, league tables are written with the signed-in user's RLS client, and service-role writes (`player_games`, `daily_totals`) use `src/lib/sync.server.ts` only after that check. Why: one guarded path for every change.
- Any change to teams, swaps or count_from calls `bustCaches()` and, for swaps and count_from, rebuilds `daily_totals`. Why: standings must reflect the change at once.
- Sign-in accounts are created only by `prepareCommissionerLogin` (emails in `admin_emails`); the client sends the link with `shouldCreateUser: false`. Why: no public sign-up.
- Draft math lives in `src/lib/engine.ts`, a behaviour-exact port of the 2026-27 helper's engine.mjs, tested in `engine.test.ts`. Don't retune or simplify it. Why: its constants were fitted to this pool's past drafts.
- The live draft is `drafts` + `draft_board` (public read, admin write, in the realtime publication); the War Room's stars, avoids and weights are `warroom_prefs` (admin only); mocks stay in the commissioner's browser. Why: the TV board shows the draft to everyone, the strategy to no one.
- The TV board reads only the public `players` table (name, team, position, last season's line). Engine data (`player_model`, `model_meta`) reaches the browser only through `warRoomData`, behind `requireCommissioner`. Why: projections and recommendations must never reach a public page.
- `model_meta.player_order` keeps players.json's order, because the engine breaks ties by it.
- A team's page is its locker (`/history?view=teams&team=<name>`, built with `lockerSearch()`); `/teams/$slot` redirects there. Current names map to locker names with `historyName()` ("TW3" is The Wheeler). Why: one page per team, this season and every season before.
- `rebuildDailyTotals` also upserts each team's roster into `roster_archive` (season, rank, points, players in draft order, swaps). The lockers show rows from past seasons only; the current season comes live from `getSeason`. Never delete old seasons' rows. Why: once a new season starts, the last sync's rows are the final rosters people look back on.
- Team badges live in `src/components/team-logo.tsx`, keyed by locker name (`historyName`), each a joke on the team's name. A team without one gets its initials; when a new team joins, draw it a badge there. Why: every team name on the site shows its badge.
- Every published change is a release: bump `version` in package.json (SemVer: 1.0.1 for a fix, 1.1.0 for a new feature, 2.0.0 for a big overhaul) and add an entry at the top of `src/data/changelog.ts`, written for the pool; `release.test.ts` fails if they don't match. The footer shows the version and build, and `/whats-new` lists every release. Why: everyone can see which version they're on and what changed.
- "Tonight" is `hockeyDay()` in `src/lib/live.ts`: the Pacific date, turning over at 3 AM. `getLive` asks NHL.com for that date's scores (and the day before's), never `score/now`. Why: NHL.com's "now" stays on last night's games until about noon Eastern, so the morning showed them as tonight.
- Man games (played, missed) and points per game come from `src/lib/man-games.ts` (pure, tested in `man-games.test.ts`), worked out from the synced game logs with no extra NHL calls; `computeSeason` adds them, and each player's games left, on top of the port without changing its numbers. A swapped player counts only while on the roster, and an NHL team's games are read from the logs' team and opponent. Why: a swap or a trade needs games by date, and the standings only give totals.
- Current injuries on public pages come from ESPN's public injury report (`src/lib/injuries.server.ts`: one call for the league, kept 20 minutes, never stored) and are matched to the pool's players in `src/lib/injuries.ts` (pure, tested in `injuries.test.ts`) by name, NHL team and position; when a match isn't certain the player shows no injury. The draft model's injury notes stay in `player_model`. Why: this is public news, not War Room strategy, and a wrong badge is worse than none (there are two Sebastian Ahos and two Elias Petterssons).
- A player's next game comes from the week's schedule the season already loads (`nextGame` on each player, added in `computeSeason` on top of the port). Why: no extra NHL calls.
- The projection is the one number where `season.ts` departs from season.js on purpose: the rate is points per game the player has played (season.js divided by his NHL team's games, so a game he sat out pulled his rate down), and the games he's expected to miss before the injury report's return date (`gamesOut` in `injuries.ts`: the week's schedule counted, then about 3 a week) aren't counted among his games to come. `computeSeason` takes the injury report and today's date for this; points and ranks are untouched. Why: a player out for five weeks was projected as if he'd play them.
