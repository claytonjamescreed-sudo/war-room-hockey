# War Room roadmap

- [x] Phase 1: schema/RLS/roles, seed all files, NHL relay, season.ts port + tests, Standings/Team/Leaders/Rules
- [x] Phase 2: Live tonight (scores, goal ticker, live re-rank, tonight column)
- [x] Phase 3: race chart (`/race`). The 12:45 UTC schedule for `/api/public/cron/sync` waits for the site to be published (it needs the stable URL).
- [x] Phase 4: commissioner magic-link login at `/admin` (claytonjamescreed@gmail.com, no public sign-up), Sync now, swaps with undo, team names, count_from with confirm. Sign-in needs the published URL allowed as an auth redirect.
- [ ] Phase 5: engine.ts port, draft order/lock, pick entry, War Room, mocks
- [ ] Phase 6: TV board (search shows Available/Taken, name, NHL team, last-season points only)
