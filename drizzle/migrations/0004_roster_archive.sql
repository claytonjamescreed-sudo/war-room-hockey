-- Each season's pool rosters, kept for the team lockers. The daily sync rewrites the current
-- season's rows, so once the season is over they hold the final rosters, and they stay when the
-- next season starts. No foreign key to seasons: the archive outlives a deleted season.

CREATE TABLE public.roster_archive (
  season_id text NOT NULL,
  slot int NOT NULL,
  team_name text NOT NULL,
  rank int NOT NULL,
  points int NOT NULL,
  -- In draft order: {id, name, team, pos, round, pick, gp, g, a, pts, added}
  players jsonb NOT NULL,
  -- Swapped out: {id, name, team, pos, gp, g, a, pts, dropped, replacedBy}
  dropped jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, slot)
);
GRANT SELECT ON public.roster_archive TO anon, authenticated;
GRANT ALL ON public.roster_archive TO service_role;
ALTER TABLE public.roster_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.roster_archive FOR SELECT USING (true);
