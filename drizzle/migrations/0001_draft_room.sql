-- Draft room: the live draft (public, for the TV board) and the commissioner's War Room
-- settings (stars, avoids, weights: commissioner only)

CREATE TABLE public.drafts (
  id text PRIMARY KEY,
  teams int NOT NULL DEFAULT 15 CHECK (teams BETWEEN 2 AND 30),
  rounds int NOT NULL DEFAULT 10 CHECK (rounds BETWEEN 1 AND 30),
  team_names jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_locked_at timestamptz,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX drafts_one_current ON public.drafts (is_current) WHERE is_current;
GRANT SELECT ON public.drafts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.drafts TO authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.drafts FOR SELECT USING (true);
CREATE POLICY "admin write" ON public.drafts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- One row per pick made, numbered from 1 in draft order. A player can only be picked once.
CREATE TABLE public.draft_board (
  draft_id text NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  pick_no int NOT NULL CHECK (pick_no >= 1),
  nhl_id int,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, pick_no),
  CHECK (nhl_id IS NOT NULL OR label IS NOT NULL)
);
CREATE UNIQUE INDEX draft_board_player ON public.draft_board (draft_id, nhl_id) WHERE nhl_id IS NOT NULL;
GRANT SELECT ON public.draft_board TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.draft_board TO authenticated;
GRANT ALL ON public.draft_board TO service_role;
ALTER TABLE public.draft_board ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.draft_board FOR SELECT USING (true);
CREATE POLICY "admin write" ON public.draft_board FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.warroom_prefs (
  draft_id text PRIMARY KEY REFERENCES public.drafts(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warroom_prefs TO authenticated;
GRANT ALL ON public.warroom_prefs TO service_role;
ALTER TABLE public.warroom_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.warroom_prefs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- A new draft carries over the teams, rounds and names and becomes the current one
CREATE FUNCTION public.start_draft(_id text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE prev public.drafts;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the commissioner can start a draft';
  END IF;
  SELECT * INTO prev FROM public.drafts WHERE is_current;
  UPDATE public.drafts SET is_current = false WHERE is_current;
  INSERT INTO public.drafts (id, teams, rounds, team_names, is_current)
  VALUES (_id, coalesce(prev.teams, 15), coalesce(prev.rounds, 10), coalesce(prev.team_names, '{}'::jsonb), true);
END $$;
REVOKE EXECUTE ON FUNCTION public.start_draft(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_draft(text) TO authenticated;

-- Screens showing the draft update the moment a pick is made
ALTER PUBLICATION supabase_realtime ADD TABLE public.drafts, public.draft_board;

-- This season's finished draft, so the draft room and TV board open on it
INSERT INTO public.drafts (id, teams, rounds, team_names, order_locked_at, is_current)
SELECT s.id, 15, 10,
  (SELECT coalesce(jsonb_object_agg(t.slot::text, t.name), '{}'::jsonb) FROM public.pool_teams t WHERE t.season_id = s.id),
  s.order_locked_at, true
FROM public.seasons s WHERE s.id = '2026-27';
INSERT INTO public.draft_board (draft_id, pick_no, nhl_id)
SELECT season_id, pick_no, nhl_id FROM public.draft_picks WHERE season_id = '2026-27';
