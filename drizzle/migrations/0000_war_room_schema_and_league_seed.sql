-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Commissioner allowlist: the signed-in user whose verified email is listed may claim admin.
CREATE TABLE public.admin_emails (email text PRIMARY KEY);
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_emails VALUES ('claytonjamescreed@gmail.com');

CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = e) THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

-- Seasons
CREATE TABLE public.seasons (
  id text PRIMARY KEY,
  nhl_season int NOT NULL,
  season_games int NOT NULL DEFAULT 84,
  count_from date NOT NULL,
  swaps_per_team int NOT NULL DEFAULT 2,
  order_locked_at timestamptz,
  is_current boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz
);
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT UPDATE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "admin update" ON public.seasons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pool_teams (
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  slot int NOT NULL CHECK (slot BETWEEN 1 AND 30),
  name text NOT NULL,
  PRIMARY KEY (season_id, slot)
);
GRANT SELECT ON public.pool_teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pool_teams TO authenticated;
GRANT ALL ON public.pool_teams TO service_role;
ALTER TABLE public.pool_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.pool_teams FOR SELECT USING (true);
CREATE POLICY "admin write" ON public.pool_teams FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.draft_picks (
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  pick_no int NOT NULL,
  round int NOT NULL,
  slot int NOT NULL,
  nhl_id int NOT NULL,
  name text NOT NULL,
  team text,
  pos text,
  preseason_proj numeric,
  PRIMARY KEY (season_id, pick_no)
);
GRANT SELECT ON public.draft_picks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.draft_picks TO authenticated;
GRANT ALL ON public.draft_picks TO service_role;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.draft_picks FOR SELECT USING (true);
CREATE POLICY "admin write" ON public.draft_picks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.roster_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  move_date date NOT NULL,
  slot int NOT NULL,
  out_id int NOT NULL,
  in_id int NOT NULL,
  in_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roster_moves TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.roster_moves TO authenticated;
GRANT ALL ON public.roster_moves TO service_role;
ALTER TABLE public.roster_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.roster_moves FOR SELECT USING (true);
CREATE POLICY "admin write" ON public.roster_moves FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Players: safe public columns only
CREATE TABLE public.players (
  nhl_id int PRIMARY KEY,
  name text NOT NULL,
  team text,
  pos text,
  last_gp int,
  last_g int,
  last_a int,
  last_pts int
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.players FOR SELECT USING (true);

-- Full model record (projections, ADP, injuries, linemates): commissioner only
CREATE TABLE public.player_model (
  nhl_id int PRIMARY KEY,
  data jsonb NOT NULL
);
GRANT SELECT ON public.player_model TO authenticated;
GRANT ALL ON public.player_model TO service_role;
ALTER TABLE public.player_model ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read" ON public.player_model FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.model_meta (
  key text PRIMARY KEY,
  data jsonb NOT NULL
);
GRANT SELECT ON public.model_meta TO authenticated;
GRANT ALL ON public.model_meta TO service_role;
ALTER TABLE public.model_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read" ON public.model_meta FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Game logs synced from NHL.com (public stats)
CREATE TABLE public.player_games (
  nhl_id int NOT NULL,
  game_id bigint NOT NULL,
  game_date date NOT NULL,
  team text,
  opp text,
  home boolean,
  goals int NOT NULL DEFAULT 0,
  assists int NOT NULL DEFAULT 0,
  PRIMARY KEY (nhl_id, game_id)
);
CREATE INDEX player_games_date ON public.player_games(game_date);
GRANT SELECT ON public.player_games TO anon, authenticated;
GRANT ALL ON public.player_games TO service_role;
ALTER TABLE public.player_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.player_games FOR SELECT USING (true);

CREATE TABLE public.daily_totals (
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  total_date date NOT NULL,
  slot int NOT NULL,
  points int NOT NULL,
  rank int NOT NULL,
  PRIMARY KEY (season_id, total_date, slot)
);
GRANT SELECT ON public.daily_totals TO anon, authenticated;
GRANT ALL ON public.daily_totals TO service_role;
ALTER TABLE public.daily_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.daily_totals FOR SELECT USING (true);

-- League seed from draft-2026-27.json
INSERT INTO public.seasons(id,nhl_season,season_games,count_from,swaps_per_team,order_locked_at,is_current) VALUES ('2026-27',20262027,84,'2026-09-29',2,'2026-09-30T02:20:27.255Z',true);
INSERT INTO public.pool_teams(season_id,slot,name) VALUES ('2026-27',1,'Rogersrabbits'),('2026-27',2,'Team MTL'),('2026-27',3,'King Bob & Queen Marie'),('2026-27',4,'Longhorn'),('2026-27',5,'Bzilla'),('2026-27',6,'Brayker'),('2026-27',7,'Pickledish'),('2026-27',8,'The Gunz'),('2026-27',9,'McCarthy''s squad'),('2026-27',10,'Unomas'),('2026-27',11,'ACE'),('2026-27',12,'Jean Guy'),('2026-27',13,'LiteMan'),('2026-27',14,'TW3'),('2026-27',15,'Redlight');
INSERT INTO public.draft_picks(season_id,pick_no,round,slot,nhl_id,name,team,pos,preseason_proj) VALUES ('2026-27',1,1,1,8478402,'Connor McDavid','EDM','C',132),('2026-27',2,1,2,8484801,'Macklin Celebrini','SJS','C',106.4),('2026-27',3,1,3,8477492,'Nathan MacKinnon','COL','C',124.2),('2026-27',4,1,4,8476453,'Nikita Kucherov','TBL','R',124),('2026-27',5,1,5,8480018,'Nick Suzuki','MTL','C',94),('2026-27',6,1,6,8477956,'David Pastrnak','BOS','R',100),('2026-27',7,1,7,8477934,'Leon Draisaitl','EDM','C',105.9),('2026-27',8,1,8,8480039,'Martin Necas','COL','C',91),('2026-27',9,1,9,8478864,'Kirill Kaprizov','MIN','L',86),('2026-27',10,1,10,8480027,'Jason Robertson','DAL','L',88.6),('2026-27',11,1,11,8476460,'Mark Scheifele','WPG','C',90.1),('2026-27',12,1,12,8481559,'Jack Hughes','NJD','C',81),('2026-27',13,1,13,8481540,'Cole Caufield','MTL','R',80.1),('2026-27',14,1,14,8478403,'Jack Eichel','VGK','C',86.9),('2026-27',15,1,15,8477939,'William Nylander','TOR','R',87.3),('2026-27',16,2,15,8478483,'Mitch Marner','VGK','R',86.1),('2026-27',17,2,14,8481557,'Matt Boldy','MIN','L',82),('2026-27',18,2,13,8480803,'Evan Bouchard','EDM','D',85.2),('2026-27',19,2,12,8479314,'Matthew Tkachuk','FLA','L',77.3),('2026-27',20,2,11,8478420,'Mikko Rantanen','DAL','R',86.1),('2026-27',21,2,10,8478398,'Kyle Connor','WPG','L',88.1),('2026-27',22,2,9,8480069,'Cale Makar','COL','D',82.5),('2026-27',23,2,8,8482740,'Wyatt Johnston','DAL','C',81.3),('2026-27',24,2,7,8479318,'Auston Matthews','TOR','C',76.6),('2026-27',25,2,6,8475913,'Mark Stone','VGK','R',67),('2026-27',26,2,5,8479343,'Clayton Keller','UTA','R',88.3),('2026-27',27,2,4,8480800,'Quinn Hughes','MIN','D',80.7),('2026-27',28,2,3,8483457,'Lane Hutson','MTL','D',72.3),('2026-27',29,2,2,8479420,'Tage Thompson','BUF','C',75.9),('2026-27',30,2,1,8478427,'Sebastian Aho','CAR','C',79.5),('2026-27',31,3,1,8478550,'Artemi Panarin','LAK','L',88.2),('2026-27',32,3,2,8477404,'Jake Guentzel','TBL','C',83.3),('2026-27',33,3,3,8471675,'Sidney Crosby','PIT','C',77.5),('2026-27',34,3,4,8478460,'Zach Werenski','CBJ','D',76.6),('2026-27',35,3,5,8484153,'Leo Carlsson','ANA','C',63.3),('2026-27',36,3,6,8479542,'Brandon Hagel','TBL','L',78.9),('2026-27',37,3,7,8476887,'Filip Forsberg','NSH','L',75),('2026-27',38,3,8,8482116,'Tim Stützle','OTT','C',78.3),('2026-27',39,3,9,8476459,'Mika Zibanejad','NYR','C',72.1),('2026-27',40,3,10,8480839,'Rasmus Dahlin','BUF','D',70.1),('2026-27',41,3,11,8479337,'Alex DeBrincat','DET','R',79.5),('2026-27',42,3,12,8480801,'Brady Tkachuk','FLA','L',69.2),('2026-27',43,3,13,8482078,'Lucas Raymond','DET','L',77.1),('2026-27',44,3,14,8480023,'Robert Thomas','STL','C',74.6),('2026-27',45,3,15,8477960,'Adrian Kempe','LAK','R',71.5),('2026-27',46,4,15,8483445,'Cutter Gauthier','ANA','L',62.7),('2026-27',47,4,14,8471215,'Evgeni Malkin','PIT','C',62.1),('2026-27',48,4,13,8483515,'Juraj Slafkovský','MTL','L',67.3),('2026-27',49,4,12,8484984,'Ivan Demidov','MTL','R',63.2),('2026-27',50,4,11,8479407,'Jesper Bratt','NJD','L',78.2),('2026-27',51,4,10,8475158,'Ryan O''Reilly','NSH','C',62.9),('2026-27',52,4,9,8480002,'Nico Hischier','NJD','C',68.7),('2026-27',53,4,8,8478010,'Brayden Point','TBL','C',70.9),('2026-27',54,4,7,8477940,'Nikolaj Ehlers','CAR','L',66.6),('2026-27',55,4,6,8477933,'Sam Reinhart','FLA','C',74.3),('2026-27',56,4,5,8482699,'Dylan Guenther','UTA','R',69.9),('2026-27',57,4,4,8479323,'Adam Fox','NYR','D',64.9),('2026-27',58,4,3,8485366,'Matthew Schaefer','NYI','D',62),('2026-27',59,4,2,8480208,'Drake Batherson','OTT','R',67),('2026-27',60,4,1,8478178,'Darren Raddysh','TOR','D',54.3),('2026-27',61,5,1,8477951,'Nick Schmaltz','UTA','C',67.4),('2026-27',62,5,2,8480830,'Andrei Svechnikov','CAR','R',62.3),('2026-27',63,5,3,8482720,'Matthew Knies','CBJ','L',60),('2026-27',64,5,4,8478449,'Roope Hintz','DAL','C',62.5),('2026-27',65,5,5,8484227,'Will Smith','SJS','C',60.2),('2026-27',66,5,6,8477964,'Ivan Barbashev','VGK','L',55.5),('2026-27',67,5,7,8484762,'Beckett Sennecke','ANA','R',62.5),('2026-27',68,5,8,8480893,'Kirill Marchenko','TOR','R',67.8),('2026-27',69,5,9,8480012,'Elias Pettersson','VAN','C',61.4),('2026-27',70,5,10,8481533,'Trevor Zegras','PHI','C',56.3),('2026-27',71,5,11,8478439,'Travis Konecny','PHI','R',68.5),('2026-27',72,5,12,8477493,'Aleksander Barkov','FLA','C',64.4),('2026-27',73,5,13,8475810,'Bryan Rust','PIT','R',60.5),('2026-27',74,5,14,8473419,'Brad Marchand','FLA','L',51.8),('2026-27',75,5,15,8478401,'Pavel Zacha','BOS','C',60.6),('2026-27',76,6,15,8477500,'Bo Horvat','NYI','C',58.3),('2026-27',77,6,14,8486103,'Ivar Stenberg','SJS','L',24),('2026-27',78,6,13,8480036,'Miro Heiskanen','DAL','D',56.2),('2026-27',79,6,12,8485406,'Porter Martone','PHI','R',60.2),('2026-27',80,6,11,8483431,'Logan Cooley','UTA','C',64.2),('2026-27',81,6,10,8475166,'John Tavares','TOR','C',65.9),('2026-27',82,6,9,8475786,'Zach Hyman','EDM','L',63.4),('2026-27',83,6,8,8475168,'Matt Duchene','DAL','C',66),('2026-27',84,6,7,8485391,'Anton Frondell','CHI','C',45.5),('2026-27',85,6,6,8477935,'Sam Bennett','FLA','C',54.9),('2026-27',86,6,5,8475692,'Mats Zuccarello Aasen','LAK','R',52.6),('2026-27',87,6,4,8476468,'J.T. Miller','NYR','C',67.4),('2026-27',88,6,3,8486067,'Gavin McKenna','TOR','L',42),('2026-27',89,6,2,8475184,'Chris Kreider','MTL','L',46.4),('2026-27',90,6,1,8477946,'Dylan Larkin','DET','C',69),('2026-27',91,7,1,8478445,'Mathew Barzal','NYI','C',62.6),('2026-27',92,7,2,8479325,'Charlie McAvoy','BOS','D',50.9),('2026-27',93,7,3,8481604,'Pavel Dorofeyev','NYR','R',54.9),('2026-27',94,7,4,8471214,'Alex Ovechkin','WSH','L',62.6),('2026-27',95,7,5,8482093,'Seth Jarvis','CAR','R',63.2),('2026-27',96,7,6,8475754,'Brock Nelson','COL','C',59.6),('2026-27',97,7,7,8479987,'Morgan Geekie','BOS','C',63.1),('2026-27',98,7,8,8478440,'Dylan Strome','WSH','C',64.9),('2026-27',99,7,9,8476881,'Tomas Hertl','VGK','C',55.5),('2026-27',100,7,10,8474564,'Steven Stamkos','NSH','C',61.9),('2026-27',101,7,11,8477949,'Alex Tuch','WSH','R',65.5),('2026-27',102,7,12,8484166,'Adam Fantilli','CBJ','C',58.6),('2026-27',103,7,13,8484144,'Connor Bedard','CHI','C',68.7),('2026-27',104,7,14,8474578,'Erik Karlsson','PIT','D',56.3),('2026-27',105,7,15,8480014,'Gabriel Vilardi','WPG','C',63.5),('2026-27',106,8,15,8474590,'John Carlson','TBL','D',54.9),('2026-27',107,8,14,8476880,'Tom Wilson','WSH','R',56.9),('2026-27',108,8,13,8476454,'Ryan Nugent-Hopkins','EDM','C',52.5),('2026-27',109,8,12,8482175,'John-Jason Peterka','BOS','R',53.4),('2026-27',110,8,11,8476389,'Vincent Trocheck','UTA','C',62.1),('2026-27',111,8,10,8474141,'Patrick Kane','CHI','R',60.5),('2026-27',112,8,9,8478493,'Joel Eriksson Ek','MIN','C',51.1),('2026-27',113,8,8,8479385,'Jordan Kyrou','WSH','R',61.3),('2026-27',114,8,7,8481528,'Dylan Cozens','OTT','C',55.5),('2026-27',115,8,6,8482077,'Dylan Holloway','STL','L',59.6),('2026-27',116,8,5,8476906,'Shayne Gostisbehere','CAR','D',53.4),('2026-27',117,8,4,8478414,'Timo Meier','NJD','R',46.6),('2026-27',118,8,3,8478444,'Brock Boeser','VAN','R',55.1),('2026-27',119,8,2,8479345,'Jakob Chychrun','WSH','D',53.1),('2026-27',120,8,1,8482105,'Jake Sanderson','OTT','D',54.8),('2026-27',121,9,1,8474600,'Roman Josi','NSH','D',57.1),('2026-27',122,9,2,8476483,'Rickard Rakell','PIT','R',52.6),('2026-27',123,9,3,8477479,'Tyler Bertuzzi','CHI','L',51.3),('2026-27',124,9,4,8482124,'Quinton Byfield','LAK','R',53.4),('2026-27',125,9,5,8484387,'Matvei Michkov','PHI','R',59.9),('2026-27',126,9,6,8478975,'Mason Marchment','SJS','L',45.6),('2026-27',127,9,7,8479410,'Mikhail Sergachev','UTA','D',53.6),('2026-27',128,9,8,8477504,'Josh Morrissey','WPG','D',57.6),('2026-27',129,9,9,8484186,'Ryan Leonard','WSH','R',44.7),('2026-27',130,9,10,8480802,'Ryan McLeod','BUF','C',51),('2026-27',131,9,11,8477955,'Jared McCann','SEA','L',57),('2026-27',132,9,12,8485402,'Michael Misa','SJS','C',41.6),('2026-27',133,9,13,8475798,'Mikael Granlund','ANA','C',53.7),('2026-27',134,9,14,8478873,'Troy Terry','ANA','R',46.2),('2026-27',135,9,15,8478042,'Viktor Arvidsson','DET','L',43.1),('2026-27',136,10,15,8482659,'Josh Doan','BUF','R',42.8),('2026-27',137,10,14,8475745,'Charlie Coyle','CBJ','C',51.9),('2026-27',138,10,13,8481542,'Moritz Seider','DET','D',53.4),('2026-27',139,10,12,8483516,'Jimmy Snuggerud','STL','R',52.7),('2026-27',140,10,11,8482079,'Marco Rossi','VAN','C',52.2),('2026-27',141,10,10,8482097,'Jack Quinn','BUF','R',46.8),('2026-27',142,10,9,8484145,'Zach Benson','BUF','L',41.1),('2026-27',143,10,8,8482109,'Alexis Lafrenière','NYR','L',54.6),('2026-27',144,10,7,8477495,'Seth Jones','FLA','D',36.3),('2026-27',145,10,6,8477409,'Carter Verhaeghe','FLA','C',57),('2026-27',146,10,5,8477942,'Kevin Fiala','LAK','L',52.9),('2026-27',147,10,4,8477447,'Shea Theodore','VGK','D',45.1),('2026-27',148,10,3,8481524,'Bowen Byram','CHI','D',42),('2026-27',149,10,2,8482745,'Mason McTavish','STL','C',45.4),('2026-27',150,10,1,8480064,'Josh Norris','BUF','C',38.1);