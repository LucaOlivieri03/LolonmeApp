-- ============================================================================
-- Migration 0005: Security & RLS Hardening
-- 1. Exclude deactivated players (is_active = false) from RLS helper functions.
-- 2. Bind player_link_requests email to authenticated JWT email claim.
-- 3. Enforce DB/RLS voting integrity (no self-votes, single MVP per voter,
--    target must be a match participant).
-- 4. Restrict non-admin UPDATEs on matches and match_players to allowed fields.
-- 5. Revoke anon SELECT on players.user_id, harden guard_player_self_update(),
--    and prevent non-admins from pinning/unpinning blog_topics.
-- ============================================================================

-- ============================================================================
-- 1. DEACTIVATED USERS RLS FIX
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_player_role()
RETURNS public.player_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.players
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_player_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.players
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- 2. PREVENT SPOOFABLE EMAIL IN player_link_requests
-- ============================================================================

DROP POLICY IF EXISTS "users_insert_own_pending_link_request" ON public.player_link_requests;
CREATE POLICY "users_insert_own_pending_link_request"
  ON public.player_link_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND btrim(email) <> ''
    AND lower(btrim(email)) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.id = requested_player_id
        AND p.is_active = true
        AND p.user_id IS NULL
        AND p.role <> 'admin'
    )
  );

-- ============================================================================
-- 3. DB & RLS VOTING INTEGRITY ON public.match_votes
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'match_votes_no_self_vote'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.match_votes
      ADD CONSTRAINT match_votes_no_self_vote
      CHECK (voter_player_id <> target_player_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_votes_one_mvp_per_voter
  ON public.match_votes (match_id, voter_player_id)
  WHERE voted_mvp = true;

DROP POLICY IF EXISTS "write_match_votes_participants" ON public.match_votes;
CREATE POLICY "write_match_votes_participants" ON public.match_votes
  FOR INSERT WITH CHECK (
    voter_player_id = public.current_player_id()
    AND voter_player_id <> target_player_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_votes.match_id AND mp.player_id = public.current_player_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp_target
      WHERE mp_target.match_id = match_votes.match_id AND mp_target.player_id = match_votes.target_player_id
    )
  );

DROP POLICY IF EXISTS "update_match_votes_participants" ON public.match_votes;
CREATE POLICY "update_match_votes_participants" ON public.match_votes
  FOR UPDATE USING (
    voter_player_id = public.current_player_id()
    AND voter_player_id <> target_player_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_votes.match_id AND mp.player_id = public.current_player_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp_target
      WHERE mp_target.match_id = match_votes.match_id AND mp_target.player_id = match_votes.target_player_id
    )
  )
  WITH CHECK (
    voter_player_id = public.current_player_id()
    AND voter_player_id <> target_player_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_votes.match_id AND m.voting_status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_votes.match_id AND mp.player_id = public.current_player_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.match_players mp_target
      WHERE mp_target.match_id = match_votes.match_id AND mp_target.player_id = match_votes.target_player_id
    )
  );

-- ============================================================================
-- 4. RESTRICT NON-ADMIN OPERATOR UPDATES ON matches AND match_players
-- ============================================================================

-- Non-admins (e.g. authorized operators) may only update voting lifecycle
-- fields on public.matches (voting_status, voting_closed_at, voting_closed_by).
CREATE OR REPLACE FUNCTION public.guard_operator_match_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.season_id IS DISTINCT FROM OLD.season_id
       OR NEW.match_number IS DISTINCT FROM OLD.match_number
       OR NEW.match_date IS DISTINCT FROM OLD.match_date
       OR NEW.match_type IS DISTINCT FROM OLD.match_type
       OR NEW.modality IS DISTINCT FROM OLD.modality
       OR NEW.team_a_score IS DISTINCT FROM OLD.team_a_score
       OR NEW.team_b_score IS DISTINCT FROM OLD.team_b_score
       OR NEW.result_outcome IS DISTINCT FROM OLD.result_outcome
       OR NEW.counts_for_league IS DISTINCT FROM OLD.counts_for_league
       OR NEW.counts_for_stats IS DISTINCT FROM OLD.counts_for_stats
       OR NEW.external_source_key IS DISTINCT FROM OLD.external_source_key
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Only admins can modify match metadata or scores.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_operator_match_update ON public.matches;
CREATE TRIGGER trg_guard_operator_match_update
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_operator_match_update();

-- Non-admins (authorized operators) may only update is_mvp, pitch_x, pitch_y
-- on public.match_players. Cooperates with trg_guard_captain_match_player_update
-- from 0004_tactical_positions.sql (which further restricts non-operator
-- captains to pitch_x and pitch_y only).
CREATE OR REPLACE FUNCTION public.guard_operator_match_player_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.match_id IS DISTINCT FROM OLD.match_id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.team IS DISTINCT FROM OLD.team
       OR NEW.is_cup_captain IS DISTINCT FROM OLD.is_cup_captain
       OR NEW.goals IS DISTINCT FROM OLD.goals
       OR NEW.assists IS DISTINCT FROM OLD.assists
       OR NEW.admin_rating IS DISTINCT FROM OLD.admin_rating
    THEN
      RAISE EXCEPTION 'Only admins can modify match player statistics or roster fields.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_operator_match_player_update ON public.match_players;
CREATE TRIGGER trg_guard_operator_match_player_update
  BEFORE UPDATE ON public.match_players
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_operator_match_player_update();

-- ============================================================================
-- 5. PROTECT players.user_id, guard_player_self_update(), AND blog_topics.is_pinned
-- ============================================================================

-- In PostgreSQL, column-level REVOKE is a no-op over table-level SELECT.
-- Revoke table-level SELECT and explicitly grant only non-sensitive columns.
REVOKE SELECT ON public.players FROM anon;
GRANT SELECT (
  id,
  slug,
  display_name,
  nickname,
  avatar_url,
  role,
  favorite_club_id,
  political_orientation,
  is_active,
  created_at
) ON public.players TO anon;

REVOKE SELECT ON public.players FROM authenticated;
GRANT SELECT (
  id,
  user_id,
  slug,
  display_name,
  nickname,
  avatar_url,
  role,
  favorite_club_id,
  political_orientation,
  is_active,
  created_at
) ON public.players TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_player_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.display_name IS DISTINCT FROM OLD.display_name
    THEN
      RAISE EXCEPTION 'Only admins can change id, created_at, role, email, user_id, active status, slug, or display_name.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_player_self_update ON public.players;
CREATE TRIGGER trg_guard_player_self_update
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_player_self_update();

CREATE OR REPLACE FUNCTION public.guard_blog_topic_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF (TG_OP = 'INSERT' AND NEW.is_pinned = true)
       OR (TG_OP = 'UPDATE' AND NEW.is_pinned IS DISTINCT FROM OLD.is_pinned)
    THEN
      RAISE EXCEPTION 'Only admins can pin or unpin blog topics.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_blog_topic_pin ON public.blog_topics;
CREATE TRIGGER trg_guard_blog_topic_pin
  BEFORE INSERT OR UPDATE ON public.blog_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_blog_topic_pin();
