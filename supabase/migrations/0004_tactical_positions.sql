-- ============================================================================
-- Migration 0004: Persistent Tactical Board Positions on match_players
-- Allows Admin/Authorized operators to save official pitch positions for both
-- teams, and Team Captains (is_cup_captain = true) to save positions strictly
-- for their own team without being able to alter scores, stats, or MVPs.
-- ============================================================================

ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS pitch_x NUMERIC(5,2)
    CHECK (pitch_x IS NULL OR (pitch_x >= 0 AND pitch_x <= 100)),
  ADD COLUMN IF NOT EXISTS pitch_y NUMERIC(5,2)
    CHECK (pitch_y IS NULL OR (pitch_y >= 0 AND pitch_y <= 100));

-- Guard trigger so non-operators (team captains) can ONLY modify pitch_x / pitch_y
CREATE OR REPLACE FUNCTION public.guard_captain_match_player_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_operator() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.match_id IS DISTINCT FROM OLD.match_id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.team IS DISTINCT FROM OLD.team
       OR NEW.is_cup_captain IS DISTINCT FROM OLD.is_cup_captain
       OR NEW.goals IS DISTINCT FROM OLD.goals
       OR NEW.assists IS DISTINCT FROM OLD.assists
       OR NEW.admin_rating IS DISTINCT FROM OLD.admin_rating
       OR NEW.is_mvp IS DISTINCT FROM OLD.is_mvp
    THEN
      RAISE EXCEPTION 'Only operators can modify match statistics or roster fields.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_captain_match_player_update ON public.match_players;
CREATE TRIGGER trg_guard_captain_match_player_update
  BEFORE UPDATE ON public.match_players
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_captain_match_player_update();

-- RLS policy allowing a match's team captain to update pitch coordinates for their own team
DROP POLICY IF EXISTS captain_update_team_tactical_positions ON public.match_players;
CREATE POLICY captain_update_team_tactical_positions
  ON public.match_players
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.match_players cap
      WHERE cap.match_id = match_players.match_id
        AND cap.player_id = public.current_player_id()
        AND cap.is_cup_captain = true
        AND cap.team = match_players.team
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.match_players cap
      WHERE cap.match_id = match_players.match_id
        AND cap.player_id = public.current_player_id()
        AND cap.is_cup_captain = true
        AND cap.team = match_players.team
    )
  );
