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
- Game logs are synced from NHL.com into `player_games` by `/api/public/cron/sync` (cron-secret protected); pages read the DB, never fetch 150 logs per request. Why: Worker subrequest limits and speed.
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
