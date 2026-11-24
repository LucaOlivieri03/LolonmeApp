-- LolonmeApp — Migration 0002: Align PostgreSQL Schema with Historical Domain & Natural Upsert Keys
-- Issue #15 (WU-1/7):
--   1. Support historical matches (e.g. 2025) that record winner/draw without exact goal scores.
--   2. Add canonical `slug` on `public.players` and `public.matches` (backfilled & collision-safe).
--   3. Add natural `external_key` unique columns for idempotent upserts across tournament entities.

-- 1. Historical outcome support and canonical match slug on public.matches
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS result_outcome text
    CHECK (result_outcome IS NULL OR result_outcome IN ('A', 'B', 'draw')),
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.matches
SET slug = COALESCE(NULLIF(trim(external_source_key), ''), id::text)
WHERE slug IS NULL OR slug = '';

WITH ranked_match_slugs AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn
  FROM public.matches
)
UPDATE public.matches m
SET slug = m.slug || '-' || substr(m.id::text, 1, 8)
FROM ranked_match_slugs r
WHERE m.id = r.id AND r.rn > 1;

ALTER TABLE public.matches
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_slug_key'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.matches ADD CONSTRAINT matches_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 2. Canonical unique slug on public.players (accent-normalized, trimmed, collision-safe)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.players
SET slug = regexp_replace(
  regexp_replace(
    lower(
      translate(
        trim(display_name),
        'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ',
        'AAAAEEEEIIIIOOOOUUUUNaaaaeeeeiiiioooouuuun'
      )
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ),
  '(^-+|-+$)',
  '',
  'g'
)
WHERE slug IS NULL;

UPDATE public.players
SET slug = id::text
WHERE slug IS NULL OR slug = '';

WITH ranked_player_slugs AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn
  FROM public.players
)
UPDATE public.players p
SET slug = p.slug || '-' || substr(p.id::text, 1, 8)
FROM ranked_player_slugs r
WHERE p.id = r.id AND r.rn > 1;

ALTER TABLE public.players
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_slug_key'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.players ADD CONSTRAINT players_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 3. Natural external keys for idempotent seed & Excel synchronization
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS external_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_external_key_key'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_external_key_key UNIQUE (external_key);
  END IF;
END $$;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS external_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'announcements_external_key_key'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_external_key_key UNIQUE (external_key);
  END IF;
END $$;

ALTER TABLE public.fund_transactions
  ADD COLUMN IF NOT EXISTS external_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fund_transactions_external_key_key'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.fund_transactions
      ADD CONSTRAINT fund_transactions_external_key_key UNIQUE (external_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fund_transactions_season_date
  ON public.fund_transactions (season_id, tx_date DESC);
