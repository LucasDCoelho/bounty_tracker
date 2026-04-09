-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  set_id uuid,
  card_number character varying NOT NULL UNIQUE,
  name text NOT NULL,
  rarity text,
  image_url text,
  game_attributes jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  current_price_min numeric,
  current_price_avg numeric,
  current_price_max numeric,
  price_updated_at timestamp with time zone,
  game_id uuid,
  CONSTRAINT cards_pkey PRIMARY KEY (id),
  CONSTRAINT cards_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.sets(id),
  CONSTRAINT cards_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.deck_cards (
  deck_id uuid NOT NULL,
  card_id uuid NOT NULL,
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  CONSTRAINT deck_cards_pkey PRIMARY KEY (deck_id, card_id),
  CONSTRAINT deck_cards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.decks(id)
);
CREATE TABLE public.decks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  game_id uuid,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  leader_card_id uuid,
  CONSTRAINT decks_pkey PRIMARY KEY (id),
  CONSTRAINT decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT decks_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT decks_leader_card_id_fkey FOREIGN KEY (leader_card_id) REFERENCES public.cards(id)
);
CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug character varying NOT NULL UNIQUE,
  publisher text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT games_pkey PRIMARY KEY (id)
);
CREATE TABLE public.price_history (
  id bigint NOT NULL DEFAULT nextval('price_history_id_seq'::regclass),
  card_id uuid,
  price_min numeric,
  price_avg numeric,
  price_max numeric,
  source character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT price_history_pkey PRIMARY KEY (id),
  CONSTRAINT price_history_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id)
);
CREATE TABLE public.sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid,
  code character varying NOT NULL UNIQUE,
  name text NOT NULL,
  release_date date,
  CONSTRAINT sets_pkey PRIMARY KEY (id),
  CONSTRAINT sets_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.store_buylists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  card_id uuid,
  buy_percentage numeric DEFAULT 50.0,
  payment_method text DEFAULT 'Crédito'::text,
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  condition text DEFAULT 'NM'::text,
  CONSTRAINT store_buylists_pkey PRIMARY KEY (id),
  CONSTRAINT store_buylists_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT store_buylists_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id)
);
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  address text,
  city text DEFAULT 'Fortaleza'::text,
  whatsapp text,
  instagram text,
  logo_url text,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stores_pkey PRIMARY KEY (id),
  CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  game_id uuid,
  name text NOT NULL,
  description text,
  event_date timestamp with time zone NOT NULL,
  entry_fee numeric DEFAULT 0.00,
  prize_pool text,
  format text DEFAULT 'Standard'::text,
  max_players integer DEFAULT 32,
  registration_link text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT tournaments_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.user_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  card_id uuid,
  target_price numeric NOT NULL,
  current_price_at_creation numeric,
  is_triggered boolean DEFAULT false,
  telegram_chat_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT user_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_alerts_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id)
);
CREATE TABLE public.user_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  card_id uuid,
  quantity integer DEFAULT 1 CHECK (quantity >= 0),
  is_foil boolean DEFAULT false,
  acquired_price numeric,
  added_at timestamp with time zone DEFAULT now(),
  condition text DEFAULT 'NM'::text,
  CONSTRAINT user_collections_pkey PRIMARY KEY (id),
  CONSTRAINT user_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_user_collections_cards FOREIGN KEY (card_id) REFERENCES public.cards(id),
  CONSTRAINT fk_user_collections_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);