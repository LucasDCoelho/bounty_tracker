-- Public community profiles + community deck feed RPC
-- Run this script in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.public_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  handle text,
  avatar_url text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_profiles_handle_unique UNIQUE (handle)
);

CREATE INDEX IF NOT EXISTS idx_public_profiles_public
ON public.public_profiles (is_public, updated_at DESC);

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_profiles_select_public" ON public.public_profiles;
DROP POLICY IF EXISTS "public_profiles_insert_own" ON public.public_profiles;
DROP POLICY IF EXISTS "public_profiles_update_own" ON public.public_profiles;
DROP POLICY IF EXISTS "public_profiles_delete_own" ON public.public_profiles;

CREATE POLICY "public_profiles_select_public"
ON public.public_profiles
FOR SELECT
USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "public_profiles_insert_own"
ON public.public_profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "public_profiles_update_own"
ON public.public_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "public_profiles_delete_own"
ON public.public_profiles
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.list_public_community_decks(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  deck_id uuid,
  deck_name text,
  created_at timestamptz,
  author_display_name text,
  leader_name text,
  total_cards integer,
  total_price numeric
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  WITH deck_totals AS (
    SELECT
      dc.deck_id,
      COALESCE(SUM(dc.quantity), 0)::integer AS total_cards,
      COALESCE(SUM(dc.quantity * COALESCE(c.current_price_avg, 0)), 0)::numeric AS main_total_price
    FROM public.deck_cards dc
    LEFT JOIN public.cards c ON c.id = dc.card_id
    GROUP BY dc.deck_id
  )
  SELECT
    d.id AS deck_id,
    d.name AS deck_name,
    d.created_at,
    COALESCE(pp.display_name, 'Usuario') AS author_display_name,
    leader.name AS leader_name,
    COALESCE(dt.total_cards, 0) AS total_cards,
    (COALESCE(dt.main_total_price, 0) + COALESCE(leader.current_price_avg, 0))::numeric AS total_price
  FROM public.decks d
  LEFT JOIN public.public_profiles pp
    ON pp.user_id = d.user_id
    AND pp.is_public = true
  LEFT JOIN public.cards leader ON leader.id = d.leader_card_id
  LEFT JOIN deck_totals dt ON dt.deck_id = d.id
  WHERE d.is_public = true
  ORDER BY d.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.list_public_community_decks(integer, integer) TO anon, authenticated;
