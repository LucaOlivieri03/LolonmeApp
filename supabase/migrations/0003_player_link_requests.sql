-- ============================================================================
-- LOLONMEBOL — 0003_player_link_requests.sql (Issue #29)
-- Google OAuth email pre-linking hardening, self-service player link requests
-- with admin approval, RLS guards, and admin-only auth-link status RPC.
-- ============================================================================

-- 1. Normalize existing preloaded emails and enforce case-insensitive uniqueness
UPDATE public.players
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

DROP INDEX IF EXISTS public.idx_players_email_lower;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email_lower
  ON public.players (lower(email))
  WHERE email IS NOT NULL;

-- 2. Player Link Requests Queue
CREATE TABLE IF NOT EXISTS public.player_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  requested_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- At most one active pending link request per authenticated account
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_link_requests_one_pending_per_user
  ON public.player_link_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_player_link_requests_status_created_at
  ON public.player_link_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_link_requests_pending_player
  ON public.player_link_requests (requested_player_id)
  WHERE status = 'pending';

-- 3. Row Level Security on player_link_requests
ALTER TABLE public.player_link_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_link_requests" ON public.player_link_requests;
CREATE POLICY "users_read_own_link_requests"
  ON public.player_link_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_pending_link_request" ON public.player_link_requests;
CREATE POLICY "users_insert_own_pending_link_request"
  ON public.player_link_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
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

DROP POLICY IF EXISTS "admin_read_all_link_requests" ON public.player_link_requests;
CREATE POLICY "admin_read_all_link_requests"
  ON public.player_link_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_link_requests" ON public.player_link_requests;
CREATE POLICY "admin_update_link_requests"
  ON public.player_link_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Harden automatic preloaded-email linking on Google OAuth / OTP sign-in
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_player_id uuid;
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.players p WHERE p.user_id = NEW.id
    ) THEN
      UPDATE public.players
      SET user_id = NEW.id,
          email = lower(btrim(NEW.email))
      WHERE id = (
        SELECT p.id
        FROM public.players p
        WHERE lower(p.email) = lower(btrim(NEW.email))
          AND p.user_id IS NULL
          AND p.is_active = true
        LIMIT 1
      )
      RETURNING id INTO v_linked_player_id;

      IF v_linked_player_id IS NOT NULL THEN
        UPDATE public.player_link_requests
        SET status = 'approved',
            reviewed_at = now(),
            review_note = COALESCE(review_note, 'Auto-vinculado por email precargado.')
        WHERE user_id = NEW.id
          AND status = 'pending';

        UPDATE public.player_link_requests
        SET status = 'rejected',
            reviewed_at = now(),
            review_note = COALESCE(review_note, 'Rechazada automáticamente al vincularse este jugador.')
        WHERE requested_player_id = v_linked_player_id
          AND user_id <> NEW.id
          AND status = 'pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at, last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. Admin-only RPC to inspect preloaded emails & link status without exposing
--    public.players.email to anon/authenticated or leaking auth.users UUIDs.
CREATE OR REPLACE FUNCTION public.admin_list_player_auth_links()
RETURNS TABLE (
  player_id uuid,
  player_slug text,
  email text,
  is_linked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin role required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS player_id,
    p.slug AS player_slug,
    p.email,
    (p.user_id IS NOT NULL) AS is_linked
  FROM public.players p
  ORDER BY p.display_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_player_auth_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_player_auth_links() TO authenticated;
