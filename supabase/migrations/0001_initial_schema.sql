-- LolonmeApp — Initial PostgreSQL Schema & Row Level Security (Supabase)
-- Covers Fase 1 (MVP Core) + schema readiness for Fase 2 & Fase 3.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.player_role AS ENUM ('admin', 'authorized', 'player');
CREATE TYPE public.title_type AS ENUM ('league', 'cup', 'lolonmebol');
CREATE TYPE public.season_status AS ENUM ('active', 'finished');
CREATE TYPE public.calendar_event_type AS ENUM (
  'league',
  'cup',
  'lolonmebol',
  'special_f11',
  'rest',
  'postponed'
);
CREATE TYPE public.match_type AS ENUM (
  'league',
  'cup',
  'lolonmebol',
  'special_f11',
  'league_tiebreaker'
);
CREATE TYPE public.match_modality AS ENUM ('F5', 'F6', 'F7', 'F11');
CREATE TYPE public.voting_status AS ENUM ('open', 'closed');
CREATE TYPE public.cup_round AS ENUM (
  'preliminary',
  'quarterfinal',
  'semifinal',
  'final',
  'lolonmebol'
);
CREATE TYPE public.fund_tx_type AS ENUM ('expense', 'yield');
CREATE TYPE public.media_type AS ENUM ('photo', 'video');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 Users, Players, Aliases & Titles
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email text UNIQUE,
  display_name text NOT NULL,
  nickname text,
  avatar_url text,
  role public.player_role NOT NULL DEFAULT 'player',
  favorite_club_id integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_email_lower ON public.players (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_players_user_id ON public.players (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE public.player_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  raw_name text NOT NULL UNIQUE
);

-- 2.2 Seasons, Calendar & Announcements
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  name text NOT NULL,
  status public.season_status NOT NULL DEFAULT 'active',
  cup_cutoff_date date
);

CREATE TABLE public.player_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  title_type public.title_type NOT NULL,
  awarded_at date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (player_id, season_id, title_type)
);

-- 2.3 Matches, Participations & Transparent Votes
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  match_number integer,
  match_date date NOT NULL,
  match_type public.match_type NOT NULL,
  modality public.match_modality NOT NULL DEFAULT 'F5',
  team_a_score integer,
  team_b_score integer,
  counts_for_league boolean NOT NULL DEFAULT true,
  counts_for_stats boolean NOT NULL DEFAULT true,
  voting_status public.voting_status NOT NULL DEFAULT 'closed',
  voting_closed_at timestamptz,
  voting_closed_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  external_source_key text UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_season_date ON public.matches (season_id, match_date DESC);

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_type public.calendar_event_type NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_date ON public.calendar_events (event_date);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team char(1) NOT NULL CHECK (team IN ('A', 'B')),
  is_cup_captain boolean NOT NULL DEFAULT false,
  goals integer NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists integer NOT NULL DEFAULT 0 CHECK (assists >= 0),
  admin_rating numeric(4, 2) CHECK (admin_rating IS NULL OR (admin_rating >= 0 AND admin_rating <= 10)),
  is_mvp boolean NOT NULL DEFAULT false,
  UNIQUE (match_id, player_id)
);

CREATE INDEX idx_match_players_player ON public.match_players (player_id);

CREATE TABLE public.match_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  voter_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating numeric(4, 2) NOT NULL CHECK (rating >= 1 AND rating <= 10),
  voted_mvp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, voter_player_id, target_player_id)
);

-- 2.4 Cup Engine (Auto + 100% Admin Editable)
CREATE TABLE public.cup_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL UNIQUE REFERENCES public.seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  cutoff_snapshot_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cup_ties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_edition_id uuid NOT NULL REFERENCES public.cup_editions(id) ON DELETE CASCADE,
  round public.cup_round NOT NULL,
  slot_order integer NOT NULL,
  player_a_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  player_b_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  seed_a integer,
  seed_b integer,
  leg1_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  leg2_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  override_score_a integer,
  override_score_b integer,
  winner_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  notes text,
  UNIQUE (cup_edition_id, round, slot_order)
);

-- 2.5 Fund & Prizes (Pozo — Admin Exclusive)
CREATE TABLE public.fund_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  month_number integer NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  month_label text NOT NULL,
  fee_amount numeric(12, 2) NOT NULL CHECK (fee_amount >= 0),
  UNIQUE (season_id, month_number)
);

CREATE TABLE public.fund_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_month_id uuid NOT NULL REFERENCES public.fund_months(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  UNIQUE (fund_month_id, player_id)
);

CREATE TABLE public.fund_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  tx_type public.fund_tx_type NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  description text NOT NULL,
  tx_date date NOT NULL DEFAULT CURRENT_DATE
);

-- 2.6 Blog, Media & Football API Cache (Fase 2–3)
CREATE TABLE public.blog_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category_tag text NOT NULL DEFAULT 'general',
  author_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.blog_topics(id) ON DELETE CASCADE,
  author_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.match_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  media_type public.media_type NOT NULL DEFAULT 'photo',
  url text NOT NULL,
  uploaded_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clubs_cache (
  club_id integer PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  league_name text,
  last_match_json jsonb,
  next_match_json jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_player_role()
RETURNS public.player_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.players WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_player_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.players WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_player_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_player_role() IN ('admin', 'authorized'), false);
$$;

-- Automatically link confirmed Supabase Auth user to pre-created player by email
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.players
    SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Prevent non-admin authenticated users from escalating their own role or modifying protected columns
-- (auth.uid() IS NULL only for privileged DB triggers / service_role since anon has no UPDATE policy)
CREATE OR REPLACE FUNCTION public.guard_player_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only admins can change role, email, user_id, or active status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_player_self_update ON public.players;
CREATE TRIGGER trg_guard_player_self_update
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_self_update();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cup_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cup_ties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_cache ENABLE ROW LEVEL SECURITY;

-- Public read-only access (guests + all authenticated users)
-- Protect email column from public/anonymous exposure
REVOKE SELECT (email) ON public.players FROM anon, authenticated;

CREATE POLICY "public_read_players" ON public.players FOR SELECT USING (true);
CREATE POLICY "public_read_player_aliases" ON public.player_aliases FOR SELECT USING (true);
CREATE POLICY "public_read_player_titles" ON public.player_titles FOR SELECT USING (true);
CREATE POLICY "public_read_seasons" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "public_read_calendar_events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "public_read_announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "public_read_matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "public_read_match_players" ON public.match_players FOR SELECT USING (true);
CREATE POLICY "public_read_cup_editions" ON public.cup_editions FOR SELECT USING (true);
CREATE POLICY "public_read_cup_ties" ON public.cup_ties FOR SELECT USING (true);
CREATE POLICY "public_read_blog_topics" ON public.blog_topics FOR SELECT USING (true);
CREATE POLICY "public_read_blog_comments" ON public.blog_comments FOR SELECT USING (true);
CREATE POLICY "public_read_match_media" ON public.match_media FOR SELECT USING (true);
CREATE POLICY "public_read_clubs_cache" ON public.clubs_cache FOR SELECT USING (true);

-- Transparent votes: readable by all once closed, or by voter/admin while open
CREATE POLICY "read_match_votes_transparent" ON public.match_votes
  FOR SELECT USING (
    public.is_admin()
    OR voter_player_id = public.current_player_id()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'closed'
    )
  );

-- Votes insert/update: only players who participated in the match while voting is open
CREATE POLICY "write_match_votes_participants" ON public.match_votes
  FOR INSERT WITH CHECK (
    voter_player_id = public.current_player_id()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_votes.match_id AND mp.player_id = public.current_player_id()
    )
  );

CREATE POLICY "update_match_votes_participants" ON public.match_votes
  FOR UPDATE USING (
    voter_player_id = public.current_player_id()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_votes.match_id AND mp.player_id = public.current_player_id()
    )
  )
  WITH CHECK (
    voter_player_id = public.current_player_id()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_votes.match_id AND mp.player_id = public.current_player_id()
    )
  );

-- Players: Admin full control; players can update their own profile fields
CREATE POLICY "admin_manage_players" ON public.players
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "player_update_own_profile" ON public.players
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin-only management tables
CREATE POLICY "admin_manage_aliases" ON public.player_aliases
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_titles" ON public.player_titles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_seasons" ON public.seasons
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_cup_editions" ON public.cup_editions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_cup_ties" ON public.cup_ties
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_clubs_cache" ON public.clubs_cache
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Operator (Admin + Authorized) management tables
CREATE POLICY "operator_manage_matches" ON public.matches
  FOR ALL USING (public.is_operator()) WITH CHECK (public.is_operator());

CREATE POLICY "operator_manage_match_players" ON public.match_players
  FOR ALL USING (public.is_operator()) WITH CHECK (public.is_operator());

CREATE POLICY "operator_manage_announcements" ON public.announcements
  FOR ALL USING (public.is_operator()) WITH CHECK (public.is_operator());

CREATE POLICY "operator_manage_calendar_events" ON public.calendar_events
  FOR ALL USING (public.is_operator()) WITH CHECK (public.is_operator());

-- Community content (Blog + Media): authenticated linked players can create; author or admin can edit/delete
CREATE POLICY "player_create_blog_topics" ON public.blog_topics
  FOR INSERT WITH CHECK (author_player_id = public.current_player_id());

CREATE POLICY "author_or_admin_manage_blog_topics" ON public.blog_topics
  FOR UPDATE USING (author_player_id = public.current_player_id() OR public.is_admin());

CREATE POLICY "author_or_admin_delete_blog_topics" ON public.blog_topics
  FOR DELETE USING (author_player_id = public.current_player_id() OR public.is_admin());

CREATE POLICY "player_create_blog_comments" ON public.blog_comments
  FOR INSERT WITH CHECK (author_player_id = public.current_player_id());

CREATE POLICY "author_or_admin_delete_blog_comments" ON public.blog_comments
  FOR DELETE USING (author_player_id = public.current_player_id() OR public.is_admin());

CREATE POLICY "player_upload_match_media" ON public.match_media
  FOR INSERT WITH CHECK (uploaded_by = public.current_player_id());

CREATE POLICY "author_or_admin_delete_match_media" ON public.match_media
  FOR DELETE USING (uploaded_by = public.current_player_id() OR public.is_admin());

-- POZO Y PREMIOS: STRICT ADMIN-ONLY (SELECT + WRITE)
CREATE POLICY "admin_only_fund_months" ON public.fund_months
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_only_fund_payments" ON public.fund_payments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_only_fund_transactions" ON public.fund_transactions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
