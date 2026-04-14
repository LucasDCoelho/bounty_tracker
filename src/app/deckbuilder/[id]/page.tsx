"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/hooks/use-auth-session';

type DeckRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  leader_card_id: string | null;
  created_at: string;
};

type DeckCardRow = {
  card_id: string;
  quantity: number;
};

type CardRow = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  rarity: string;
  current_price_avg: number | null;
};

type DeckCard = {
  card: CardRow;
  quantity: number;
};

export default function DeckDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuthSession();
  const deckId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [deck, setDeck] = useState<DeckRow | null>(null);
  const [leader, setLeader] = useState<CardRow | null>(null);
  const [mainDeck, setMainDeck] = useState<DeckCard[]>([]);

  useEffect(() => {
    if (!deckId) return;

    const fetchDeckDetails = async () => {
      setIsLoading(true);
      setIsForbidden(false);

      const { data: deckData, error: deckError } = await supabase
        .from('decks')
        .select('id, user_id, name, description, is_public, leader_card_id, created_at')
        .eq('id', deckId)
        .single();

      if (deckError || !deckData) {
        setDeck(null);
        setMainDeck([]);
        setLeader(null);
        setIsLoading(false);
        return;
      }

      const deckRow = deckData as DeckRow;
      const isOwner = !!session?.user.id && session.user.id === deckRow.user_id;
      const canView = deckRow.is_public || isOwner;

      if (!canView && !authLoading) {
        setIsForbidden(true);
        setDeck(deckRow);
        setMainDeck([]);
        setLeader(null);
        setIsLoading(false);
        return;
      }

      const { data: deckCardsData } = await supabase
        .from('deck_cards')
        .select('card_id, quantity')
        .eq('deck_id', deckId)
        .order('quantity', { ascending: false });

      const deckCardsRows = (deckCardsData ?? []) as DeckCardRow[];
      const mainIds = Array.from(new Set(deckCardsRows.map((row) => row.card_id)));

      const cardIds = Array.from(
        new Set([
          ...mainIds,
          ...(deckRow.leader_card_id ? [deckRow.leader_card_id] : []),
        ])
      );

      if (cardIds.length === 0) {
        setDeck(deckRow);
        setLeader(null);
        setMainDeck([]);
        setIsLoading(false);
        return;
      }

      const { data: cardsData } = await supabase
        .from('cards')
        .select('id, name, card_number, image_url, rarity, current_price_avg')
        .in('id', cardIds);

      const cards = (cardsData ?? []) as CardRow[];
      const cardMap = new Map(cards.map((card) => [card.id, card]));

      const leaderCard = deckRow.leader_card_id ? cardMap.get(deckRow.leader_card_id) ?? null : null;

      const builtMainDeck = deckCardsRows
        .map((row) => {
          const card = cardMap.get(row.card_id);
          if (!card) return null;
          return { card, quantity: row.quantity };
        })
        .filter(Boolean) as DeckCard[];

      builtMainDeck.sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.card.card_number.localeCompare(b.card.card_number);
      });

      setDeck(deckRow);
      setLeader(leaderCard);
      setMainDeck(builtMainDeck);
      setIsLoading(false);
    };

    fetchDeckDetails();
  }, [deckId, session?.user.id, authLoading]);

  const totalCards = useMemo(
    () => mainDeck.reduce((acc, item) => acc + item.quantity, 0),
    [mainDeck]
  );

  const totalPrice = useMemo(() => {
    const mainTotal = mainDeck.reduce(
      (acc, item) => acc + Number(item.card.current_price_avg ?? 0) * item.quantity,
      0
    );
    const leaderPrice = Number(leader?.current_price_avg ?? 0);
    return mainTotal + leaderPrice;
  }, [mainDeck, leader]);

  if (isLoading) {
    return (
      <main className="flex justify-center items-center bg-background min-h-screen">
        <div className="border-primary border-t-2 rounded-full w-12 h-12 animate-spin"></div>
      </main>
    );
  }

  if (!deck) {
    return (
      <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
        <div className="mx-auto max-w-5xl">
          <Link href="/deckbuilder" className="inline-flex items-center mb-6 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar ao Deckbuilder
          </Link>
          <div className="bg-surface p-8 border border-border rounded-xl text-center">
            <h1 className="font-bold text-2xl">Deck nao encontrado</h1>
            <p className="mt-2 text-muted-foreground">Confira se o link esta correto.</p>
          </div>
        </div>
      </main>
    );
  }

  if (isForbidden) {
    return (
      <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
        <div className="mx-auto max-w-5xl">
          <Link href="/deckbuilder" className="inline-flex items-center mb-6 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar ao Deckbuilder
          </Link>
          <div className="bg-surface p-8 border border-border rounded-xl text-center">
            <h1 className="font-bold text-2xl">Deck privado</h1>
            <p className="mt-2 text-muted-foreground">Somente o dono do deck pode visualizar os detalhes.</p>
            {!session && (
              <button
                onClick={() => router.push('/login')}
                className="bg-primary hover:bg-primary/90 mt-4 px-4 py-2 rounded-md font-bold text-primary-foreground text-sm"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-3 mb-6">
          <Link href="/deckbuilder" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar ao Deckbuilder
          </Link>
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded border text-xs font-bold ${deck.is_public ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warning'}`}>
            {deck.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {deck.is_public ? 'Publico' : 'Privado'}
          </span>
        </div>

        <section className="bg-surface mb-6 p-5 border border-border rounded-xl">
          <h1 className="font-black text-3xl">{deck.name}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Criado em {new Date(deck.created_at).toLocaleDateString('pt-BR')} • Main deck: {totalCards}/50
          </p>
          <p className="mt-3 font-bold text-primary text-xl">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">Valor de referencia com base na liga.</p>
        </section>

        <section className="bg-surface mb-6 p-5 border border-border rounded-xl">
          <h2 className="mb-3 font-bold text-muted-foreground text-sm uppercase tracking-wider">Lider (1/1)</h2>
          {leader ? (
            <div className="flex sm:flex-row flex-col gap-4 bg-background p-3 border border-primary/30 rounded-lg">
              <img src={leader.image_url} alt={leader.name} className="shadow-md rounded w-28 h-40 object-cover" />
              <div>
                <p className="font-bold text-xl">{leader.name}</p>
                <p className="text-muted-foreground text-sm">{leader.card_number} • {leader.rarity}</p>
                <p className="mt-2 font-bold text-success">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(leader.current_price_avg ?? 0))}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-background p-4 border border-border border-dashed rounded-lg text-muted-foreground">Sem lider definido neste deck.</div>
          )}
        </section>

        <section className="bg-surface p-5 border border-border rounded-xl">
          <h2 className="mb-3 font-bold text-muted-foreground text-sm uppercase tracking-wider">Deck principal ({totalCards})</h2>
          {mainDeck.length === 0 ? (
            <div className="bg-background p-4 border border-border rounded-lg text-muted-foreground">Nenhuma carta no deck principal.</div>
          ) : (
            <div className="space-y-2">
              {mainDeck.map((item) => (
                <div key={item.card.id} className="flex justify-between items-center bg-background p-2 border border-border rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={item.card.image_url} alt={item.card.name} className="rounded w-12 h-16 object-cover" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.card.name}</p>
                      <p className="text-muted-foreground text-xs">{item.card.card_number} • {item.card.rarity}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary text-lg">x{item.quantity}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.card.current_price_avg ?? 0))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
