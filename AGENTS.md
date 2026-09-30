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
