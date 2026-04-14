-- RLS and security hardening for public.decks and public.deck_cards
-- Run this script in Supabase SQL Editor.

-- Optional schema fix: ensure card_id references cards.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deck_cards_card_id_fkey'
  ) THEN
    ALTER TABLE public.deck_cards
    ADD CONSTRAINT deck_cards_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES public.cards(id);
  END IF;
END
$$;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;

-- Remove legacy/duplicate policies that could expose private decks.
DROP POLICY IF EXISTS "Leitura pública de decks" ON public.decks;
DROP POLICY IF EXISTS "Usuários criam seus próprios decks" ON public.decks;
DROP POLICY IF EXISTS "Usuários deletam seus próprios decks" ON public.decks;
DROP POLICY IF EXISTS "decks_select_public_or_owner" ON public.decks;
DROP POLICY IF EXISTS "decks_insert_own" ON public.decks;
DROP POLICY IF EXISTS "decks_update_own" ON public.decks;
DROP POLICY IF EXISTS "decks_delete_own" ON public.decks;

CREATE POLICY "decks_select_public_or_owner"
ON public.decks
FOR SELECT
USING (
  is_public = true
  OR user_id = auth.uid()
);

CREATE POLICY "decks_insert_own"
ON public.decks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "decks_update_own"
ON public.decks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "decks_delete_own"
ON public.decks
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "deck_cards_select_visible_deck" ON public.deck_cards;
DROP POLICY IF EXISTS "deck_cards_insert_owner_deck" ON public.deck_cards;
DROP POLICY IF EXISTS "deck_cards_update_owner_deck" ON public.deck_cards;
DROP POLICY IF EXISTS "deck_cards_delete_owner_deck" ON public.deck_cards;
DROP POLICY IF EXISTS "Leitura pública de cards de decks" ON public.deck_cards;

CREATE POLICY "deck_cards_select_visible_deck"
ON public.deck_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = deck_cards.deck_id
      AND (d.is_public = true OR d.user_id = auth.uid())
  )
);

CREATE POLICY "deck_cards_insert_owner_deck"
ON public.deck_cards
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = deck_cards.deck_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY "deck_cards_update_owner_deck"
ON public.deck_cards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = deck_cards.deck_id
      AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = deck_cards.deck_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY "deck_cards_delete_owner_deck"
ON public.deck_cards
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = deck_cards.deck_id
      AND d.user_id = auth.uid()
  )
);

-- Helpful indexes for community deck listing and ownership queries.
CREATE INDEX IF NOT EXISTS idx_decks_public_created_at
ON public.decks (is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decks_user_id
ON public.decks (user_id);

CREATE INDEX IF NOT EXISTS idx_deck_cards_deck_id
ON public.deck_cards (deck_id);

-- Fix Supabase advisor warning (0011_function_search_path_mutable).
CREATE OR REPLACE FUNCTION public.get_utc_date(ts timestamp without time zone)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT (ts AT TIME ZONE 'UTC')::date
$function$;

CREATE OR REPLACE FUNCTION public.get_utc_date(ts timestamp with time zone)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT (ts AT TIME ZONE 'UTC')::date
$function$;
