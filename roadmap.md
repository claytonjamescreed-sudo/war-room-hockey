# War Room roadmap

- [x] Phase 1: schema/RLS/roles, seed all files, NHL relay, season.ts port + tests, Standings/Team/Leaders/Rules
- [x] Phase 2: Live tonight (scores, goal ticker, live re-rank, tonight column)
- [x] Phase 3: race chart (`/race`) and the morning update: pg_cron jobs `war-room-sync-a`/`-b` call `/api/public/cron/sync` at 12:45 and 12:50 UTC (migration 0003).
- [x] Phase 4: commissioner magic-link login at `/admin` (claytonjamescreed@gmail.com, no public sign-up), Sync now, swaps with undo, team names, count_from with confirm. Sign-in needs the published URL allowed as an auth redirect.
- [x] Phase 5: draft room at `/draft` (commissioner): engine.ts port (checked against engine.mjs on 1,944 scenarios), draft order with randomize/lock/unlock, pick entry/undo/fix, War Room recommendations, stars/avoids/weights, mocks on the device
- [x] Phase 6: TV board at `/tv` (public, always dark): on the clock/up next/on deck, "is he available?" search, draft board with hide toggle, self-scrolling available list, team pop-ups, live via Supabase realtime; commissioner can draft and undo from it
- [x] History (`/history`): champions' banners, records, top 3 of every pool and a locker per team, from the "Banners in the Rafters" page. The data is `src/data/history.ts` (OfficePools totals, 2020-21 to the 2026 playoffs); add each finished season there.
- [x] Team lockers are the team pages: this season's roster (live points, swaps, projection) at the top of each locker, and every past season's final roster below it from `roster_archive` (migration 0004), which the morning sync keeps up to date. The archive starts with 2026-27.
