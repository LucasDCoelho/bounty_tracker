"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { consumePendingDeckCard } from '@/lib/flow-bridge';
import { trackEvent } from '@/lib/telemetry';
import { useAuthSession } from '@/hooks/use-auth-session';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Layers,
  Eye,
  Save,
  Lock,
  Globe,
} from 'lucide-react';

type Card = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  rarity: string;
  price: number;
};

type DeckItem = {
  card: Card;
  quantity: number;
};

type DeckRow = {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
  leader_card_id: string | null;
};

type DeckCardRow = {
  deck_id: string;
  card_id: string;
  quantity: number;
};

type SavedDeck = {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  totalCards: number;
  leaderName: string | null;
};

export default function Deckbuilder() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuthSession();

  const [leader, setLeader] = useState<Card | null>(null);
  const [deck, setDeck] = useState<DeckItem[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'card_number_asc' | 'name_asc' | 'price_asc' | 'price_desc'>('card_number_asc');
  const [onlyMainDeckCards, setOnlyMainDeckCards] = useState(true);
  const [leaderSearchTerm, setLeaderSearchTerm] = useState('');
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [isLoadingLeaders, setIsLoadingLeaders] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  const [deckName, setDeckName] = useState('');
  const [deckVisibility, setDeckVisibility] = useState<'public' | 'private'>('public');
  const [isSaving, setIsSaving] = useState(false);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [isLoadingSavedDecks, setIsLoadingSavedDecks] = useState(false);

  useEffect(() => {
    setSource(new URLSearchParams(window.location.search).get('source'));
    trackEvent({
      eventName: 'deckbuilder_view',
      properties: {
        source: new URLSearchParams(window.location.search).get('source') || 'direct',
      },
    });

    const pending = consumePendingDeckCard();
    if (!pending) return;

    const incoming: Card = {
      id: pending.id,
      name: pending.name,
      card_number: pending.card_number,
      image_url: pending.image_url,
      rarity: pending.rarity,
      price: pending.price,
    };

    if (incoming.rarity === 'L') {
      setLeader(incoming);
      trackEvent({
        eventName: 'deckbuilder_leader_set',
        properties: {
          cardId: incoming.id,
          cardName: incoming.name,
          source: 'pending_card',
        },
      });
      return;
    }

    setDeck((prev) => {
      const total = prev.reduce((acc, item) => acc + item.quantity, 0);
      if (total >= 50) return prev;

      const existing = prev.find((item) => item.card.card_number === incoming.card_number);
      if (existing && existing.quantity >= 4) return prev;

      if (existing) {
        return prev.map((item) =>
          item.card.card_number === incoming.card_number
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { card: incoming, quantity: 1 }];
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!session?.user.id) {
      setSavedDecks([]);
      return;
    }

    const loadSavedDecks = async () => {
      setIsLoadingSavedDecks(true);

      const { data: decksData, error: deckError } = await supabase
        .from('decks')
        .select('id, name, is_public, created_at, leader_card_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (deckError || !decksData || decksData.length === 0) {
        setSavedDecks([]);
        setIsLoadingSavedDecks(false);
        return;
      }

      const decks = decksData as DeckRow[];
      const deckIds = decks.map((item) => item.id);
      const leaderIds = Array.from(new Set(decks.map((item) => item.leader_card_id).filter(Boolean))) as string[];

      const [{ data: deckCardsData }, { data: leaderCardsData }] = await Promise.all([
        supabase.from('deck_cards').select('deck_id, card_id, quantity').in('deck_id', deckIds),
        leaderIds.length > 0
          ? supabase.from('cards').select('id, name').in('id', leaderIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

      const deckCards = (deckCardsData ?? []) as DeckCardRow[];
      const leaderCards = (leaderCardsData ?? []) as { id: string; name: string }[];

      const totalByDeck = deckCards.reduce<Record<string, number>>((acc, row) => {
        acc[row.deck_id] = (acc[row.deck_id] ?? 0) + (row.quantity ?? 0);
        return acc;
      }, {});

      const leaderMap = new Map(leaderCards.map((item) => [item.id, item.name]));

      setSavedDecks(
        decks.map((item) => ({
          id: item.id,
          name: item.name,
          isPublic: item.is_public,
          createdAt: item.created_at,
          totalCards: totalByDeck[item.id] ?? 0,
          leaderName: item.leader_card_id ? leaderMap.get(item.leader_card_id) ?? null : null,
        }))
      );

      setIsLoadingSavedDecks(false);
    };

    loadSavedDecks();
  }, [session?.user.id, authLoading]);

  useEffect(() => {
    const loadLeaders = async () => {
      setIsLoadingLeaders(true);

      let query = supabase
        .from('cards')
        .select('id, name, card_number, image_url, rarity, current_price_avg')
        .eq('rarity', 'L')
        .order('name', { ascending: true })
        .limit(12);

      if (leaderSearchTerm.trim()) {
        const term = leaderSearchTerm.trim();
        query = query.or(`name.ilike.%${term}%,card_number.ilike.%${term}%`);
      }

      const { data, error } = await query;

      if (!error && data) {
        setLeaders(
          data.map((card) => ({
            id: card.id,
            name: card.name,
            card_number: card.card_number,
            image_url: card.image_url,
            rarity: card.rarity,
            price: Number(card.current_price_avg ?? 0),
          }))
        );
      }

      setIsLoadingLeaders(false);
    };

    const timer = setTimeout(() => {
      loadLeaders();
    }, 250);

    return () => clearTimeout(timer);
  }, [leaderSearchTerm]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSearching(true);
    let query = supabase
      .from('cards')
      .select('id, name, card_number, image_url, rarity, current_price_avg');

    const term = searchTerm.trim();
    if (term) {
      query = query.or(`name.ilike.%${term}%,card_number.ilike.%${term}%`);
    }

    if (rarityFilter !== 'all') {
      query = query.eq('rarity', rarityFilter);
    }

    if (onlyMainDeckCards) {
      query = query.neq('rarity', 'L');
    }

    if (sortBy === 'name_asc') {
      query = query.order('name', { ascending: true });
    } else if (sortBy === 'price_asc') {
      query = query.order('current_price_avg', { ascending: true, nullsFirst: false });
    } else if (sortBy === 'price_desc') {
      query = query.order('current_price_avg', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('card_number', { ascending: true });
    }

    const { data, error } = await query.limit(30);

    if (!error && data) {
      setSearchResults(
        data.map((card) => ({
          id: card.id,
          name: card.name,
          card_number: card.card_number,
          image_url: card.image_url,
          rarity: card.rarity,
          price: Number(card.current_price_avg ?? 0),
        }))
      );
    }

    setIsSearching(false);
  };

  const totalCards = useMemo(
    () => deck.reduce((acc, item) => acc + item.quantity, 0),
    [deck]
  );

  const totalPrice = useMemo(
    () => deck.reduce((acc, item) => acc + (item.card.price * item.quantity), 0) + (leader?.price || 0),
    [deck, leader]
  );

  const addCard = (card: Card) => {
    if (card.rarity === 'L') {
      setLeader(card);
      trackEvent({
        eventName: 'deckbuilder_leader_set',
        properties: {
          cardId: card.id,
          cardName: card.name,
          source: 'search_result',
        },
      });
      return;
    }

    if (totalCards >= 50) {
      alert('O deck principal ja atingiu o limite de 50 cartas.');
      return;
    }

    const existingItem = deck.find((item) => item.card.card_number === card.card_number);
    if (existingItem && existingItem.quantity >= 4) {
      alert('Voce so pode ter no maximo 4 copias da mesma carta.');
      return;
    }

    if (existingItem) {
      setDeck(
        deck.map((item) =>
          item.card.card_number === card.card_number
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      trackEvent({
        eventName: 'deckbuilder_card_added',
        properties: {
          cardId: card.id,
          cardName: card.name,
          cardNumber: card.card_number,
          quantity: existingItem.quantity + 1,
        },
      });
      return;
    }

    setDeck([...deck, { card, quantity: 1 }]);
    trackEvent({
      eventName: 'deckbuilder_card_added',
      properties: {
        cardId: card.id,
        cardName: card.name,
        cardNumber: card.card_number,
        quantity: 1,
      },
    });
  };

  const removeCard = (cardNumber: string, removeAll: boolean = false) => {
    const existingItem = deck.find((item) => item.card.card_number === cardNumber);
    if (!existingItem) return;

    if (existingItem.quantity > 1 && !removeAll) {
      setDeck(
        deck.map((item) =>
          item.card.card_number === cardNumber
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      );
      trackEvent({
        eventName: 'deckbuilder_card_removed',
        properties: {
          cardNumber,
          removeAll: false,
        },
      });
      return;
    }

    setDeck(deck.filter((item) => item.card.card_number !== cardNumber));
    trackEvent({
      eventName: 'deckbuilder_card_removed',
      properties: {
        cardNumber,
        removeAll,
      },
    });
  };

  const reloadSavedDecks = async () => {
    if (!session?.user.id) return;

    setIsLoadingSavedDecks(true);

    const { data: decksData } = await supabase
      .from('decks')
      .select('id, name, is_public, created_at, leader_card_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!decksData || decksData.length === 0) {
      setSavedDecks([]);
      setIsLoadingSavedDecks(false);
      return;
    }

    const decks = decksData as DeckRow[];
    const deckIds = decks.map((item) => item.id);
    const leaderIds = Array.from(new Set(decks.map((item) => item.leader_card_id).filter(Boolean))) as string[];

    const [{ data: cardsData }, { data: leadersData }] = await Promise.all([
      supabase.from('deck_cards').select('deck_id, card_id, quantity').in('deck_id', deckIds),
      leaderIds.length > 0
        ? supabase.from('cards').select('id, name').in('id', leaderIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const totals = (cardsData as DeckCardRow[] | null)?.reduce<Record<string, number>>((acc, row) => {
      acc[row.deck_id] = (acc[row.deck_id] ?? 0) + (row.quantity ?? 0);
      return acc;
    }, {}) ?? {};

    const leaderMap = new Map(((leadersData as { id: string; name: string }[] | null) ?? []).map((item) => [item.id, item.name]));

    setSavedDecks(
      decks.map((item) => ({
        id: item.id,
        name: item.name,
        isPublic: item.is_public,
        createdAt: item.created_at,
        totalCards: totals[item.id] ?? 0,
        leaderName: item.leader_card_id ? leaderMap.get(item.leader_card_id) ?? null : null,
      }))
    );

    setIsLoadingSavedDecks(false);
  };

  const handleSaveDeck = async () => {
    if (!session?.user.id) {
      router.push('/login');
      return;
    }

    if (!deckName.trim()) {
      alert('De um nome para o deck antes de salvar.');
      return;
    }

    if (!leader) {
      alert('Escolha um lider para o deck.');
      return;
    }

    if (totalCards !== 50) {
      alert('O deck principal precisa ter exatamente 50 cartas.');
      return;
    }

    setIsSaving(true);

    const { data: insertedDeck, error: deckError } = await supabase
      .from('decks')
      .insert([
        {
          user_id: session.user.id,
          name: deckName.trim(),
          is_public: deckVisibility === 'public',
          leader_card_id: leader.id,
        },
      ])
      .select('id')
      .single();

    if (deckError || !insertedDeck?.id) {
      alert(deckError?.message || 'Nao foi possivel salvar o deck.');
      setIsSaving(false);
      return;
    }

    const rows = deck.map((item) => ({
      deck_id: insertedDeck.id,
      card_id: item.card.id,
      quantity: item.quantity,
    }));

    const { error: deckCardsError } = await supabase.from('deck_cards').insert(rows);

    if (deckCardsError) {
      await supabase.from('decks').delete().eq('id', insertedDeck.id).eq('user_id', session.user.id);
      alert(deckCardsError.message || 'Nao foi possivel salvar as cartas do deck.');
      setIsSaving(false);
      return;
    }

    alert('Deck salvo com sucesso.');
    trackEvent({
      eventName: 'deckbuilder_saved',
      properties: {
        deckId: insertedDeck.id,
        deckName: deckName.trim(),
        visibility: deckVisibility,
        totalCards,
        totalPrice,
      },
    });
    setDeckName('');
    setDeckVisibility('public');
    await reloadSavedDecks();
    setIsSaving(false);
  };

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="flex sm:flex-row flex-col justify-between sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-2 w-5 h-5" />
              Voltar
            </Link>
            <Link href="/deckbuilder/comunidade" className="inline-flex items-center pl-3 border-border border-l text-muted-foreground hover:text-primary transition-colors">
              Comunidade
            </Link>
          </div>
          <h1 className="flex items-center gap-2 bg-clip-text bg-linear-to-r from-primary to-secondary font-bold text-transparent text-2xl">
            Deckbuilder <Layers className="w-6 h-6 text-primary" />
          </h1>
        </header>

        {source && (
          <div className="bg-secondary/10 mb-4 px-4 py-2 border border-secondary/20 rounded-lg text-secondary text-xs">
            Carta recebida do fluxo: <span className="font-bold uppercase">{source}</span>
          </div>
        )}

        <div className="gap-8 grid grid-cols-1 lg:grid-cols-12">
          <div className="flex flex-col lg:col-span-5 bg-surface p-4 border border-border rounded-xl lg:h-[80vh]">
            <div className="space-y-3 mb-4">
              <div className="bg-background p-3 border border-border rounded-lg">
                <p className="mb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">Escolher lider</p>
                <input
                  type="text"
                  placeholder="Pesquisar lider por nome ou numero"
                  value={leaderSearchTerm}
                  onChange={(e) => setLeaderSearchTerm(e.target.value)}
                  className="bg-surface mb-2 px-3 py-2 border border-border focus:border-primary rounded-md outline-none w-full text-foreground text-sm"
                />
                {isLoadingLeaders ? (
                  <p className="text-muted-foreground text-xs">Buscando lideres...</p>
                ) : leaders.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Nenhum lider encontrado.</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {leaders.map((leaderCard) => (
                      <button
                        key={leaderCard.id}
                        onClick={() => setLeader(leaderCard)}
                        className="flex justify-between items-center hover:bg-accent px-2 py-1.5 rounded w-full text-left transition-colors"
                      >
                        <span className="min-w-0 font-semibold text-xs truncate">{leaderCard.name}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground whitespace-nowrap">{leaderCard.card_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSearch} className="space-y-2">
                <div className="flex">
                  <input
                    type="text"
                    placeholder="Buscar carta por nome ou numero"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-background px-4 py-3 border border-border focus:border-primary rounded-l-md outline-none w-full text-foreground"
                  />
                  <button type="submit" className="bg-background hover:bg-accent px-6 border border-border border-l-0 rounded-r-md transition-colors">
                    {isSearching ? <div className="border-primary border-t-2 rounded-full w-5 h-5 animate-spin"></div> : <Search className="w-5 h-5 text-primary" />}
                  </button>
                </div>

                <div className="gap-2 grid grid-cols-1 sm:grid-cols-2">
                  <select
                    value={rarityFilter}
                    onChange={(e) => setRarityFilter(e.target.value)}
                    className="bg-background px-3 py-2 border border-border focus:border-primary rounded-md outline-none text-sm"
                  >
                    <option value="all">Todas raridades</option>
                    <option value="L">Lider (L)</option>
                    <option value="SEC">SEC</option>
                    <option value="SP">SP</option>
                    <option value="SR">SR</option>
                    <option value="R">R</option>
                    <option value="UC">UC</option>
                    <option value="C">C</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'card_number_asc' | 'name_asc' | 'price_asc' | 'price_desc')}
                    className="bg-background px-3 py-2 border border-border focus:border-primary rounded-md outline-none text-sm"
                  >
                    <option value="card_number_asc">Ordenar: Numero</option>
                    <option value="name_asc">Ordenar: Nome</option>
                    <option value="price_asc">Ordenar: Menor preco</option>
                    <option value="price_desc">Ordenar: Maior preco</option>
                  </select>
                </div>

                <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-muted-foreground text-xs">
                    <input
                      type="checkbox"
                      checked={onlyMainDeckCards}
                      onChange={(e) => setOnlyMainDeckCards(e.target.checked)}
                    />
                    Esconder lideres (facilita montar as 50 cartas)
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setRarityFilter('all');
                      setSortBy('card_number_asc');
                      setOnlyMainDeckCards(true);
                      setSearchResults([]);
                    }}
                    className="text-muted-foreground hover:text-primary text-xs transition-colors"
                  >
                    Limpar filtros
                  </button>
                </div>
              </form>
            </div>

            <div className="flex-1 space-y-2 pr-2 overflow-y-auto custom-scrollbar">
              {searchResults.length === 0 && !isSearching && (
                <p className="mt-10 text-muted-foreground text-center">Use os filtros e clique em buscar para encontrar cartas</p>
              )}
              {searchResults.map((card) => (
                <div key={card.id} className="group flex justify-between items-center bg-background p-2 border border-border rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={card.image_url} alt={card.name} className="shadow-sm rounded w-12 h-16 object-cover" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{card.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 px-1.5 py-0.5 rounded font-bold text-[10px] text-primary">{card.rarity}</span>
                        <span className="text-muted-foreground text-xs">{card.card_number}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => addCard(card)}
                    className="bg-background hover:bg-primary p-2 rounded-md text-muted-foreground hover:text-primary-foreground transition-colors"
                    title={card.rarity === 'L' ? 'Definir como Lider' : 'Adicionar ao Deck'}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:col-span-7 bg-surface p-4 border border-border rounded-xl lg:h-[80vh]">
            <div className="space-y-3 bg-background mb-6 p-4 border border-border rounded-lg">
              <p className="font-bold text-muted-foreground text-xs uppercase tracking-widest">Salvar deck para a comunidade</p>
              <div className="flex sm:flex-row flex-col gap-2">
                <input
                  type="text"
                  value={deckName}
                  onChange={(event) => setDeckName(event.target.value)}
                  placeholder="Nome do deck"
                  className="flex-1 bg-surface px-3 py-2 border border-border focus:border-primary rounded-md outline-none text-foreground text-sm"
                />
                <select
                  value={deckVisibility}
                  onChange={(event) => setDeckVisibility(event.target.value as 'public' | 'private')}
                  className="bg-surface px-3 py-2 border border-border focus:border-primary rounded-md outline-none text-foreground text-sm"
                >
                  <option value="public">Publico (comunidade)</option>
                  <option value="private">Privado (so voce)</option>
                </select>
                <button
                  onClick={handleSaveDeck}
                  disabled={isSaving}
                  className="inline-flex justify-center items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 px-4 py-2 rounded-md font-bold text-primary-foreground text-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar deck'}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center bg-background mb-6 p-4 border border-border rounded-lg">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-widest">Cartas</p>
                <p className={`text-2xl font-black ${totalCards === 50 ? 'text-success' : 'text-foreground'}`}>
                  {totalCards} / 50
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs uppercase tracking-widest">Valor do Deck (Liga)</p>
                <p className="font-black text-primary text-2xl">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-6 pr-2 overflow-y-auto custom-scrollbar">
              <div>
                <h3 className="flex justify-between items-center mb-2 font-bold text-muted-foreground text-sm uppercase tracking-wider">
                  <span>Lider (1/1)</span>
                  {leader && <button onClick={() => setLeader(null)} className="text-danger hover:text-danger/80 text-xs">Remover</button>}
                </h3>
                {leader ? (
                  <div className="flex items-center gap-4 bg-background p-3 border border-primary/30 rounded-lg">
                    <img src={leader.image_url} alt={leader.name} className="shadow-md rounded w-16 h-24 object-cover" />
                    <div>
                      <p className="font-bold text-foreground text-lg">{leader.name}</p>
                      <p className="text-muted-foreground text-sm">{leader.card_number}</p>
                      <p className="mt-1 font-bold text-success">R$ {leader.price.toFixed(2)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center items-center bg-background border border-border border-dashed rounded-lg h-24 text-muted-foreground">
                    Nenhum lider selecionado
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-bold text-muted-foreground text-sm uppercase tracking-wider">
                  Deck principal ({totalCards})
                </h3>
                {deck.length === 0 ? (
                  <p className="py-6 text-muted-foreground text-center">Adicione cartas da busca para comecar a montar seu deck.</p>
                ) : (
                  <div className="space-y-2">
                    {deck.map((item) => (
                      <div key={item.card.card_number} className="flex justify-between items-center bg-background p-2 border border-border rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={item.card.image_url} alt={item.card.name} className="rounded w-10 h-14 object-cover" />
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{item.card.name}</p>
                            <p className="text-muted-foreground text-xs">{item.card.card_number} • R$ {item.card.price.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-surface p-1 border border-border rounded-md">
                          <button onClick={() => removeCard(item.card.card_number)} className="p-1 hover:text-danger transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-4 font-black text-center">{item.quantity}</span>
                          <button onClick={() => addCard(item.card)} className="p-1 hover:text-success transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeCard(item.card.card_number, true)} className="ml-1 p-1 pl-2 border-border border-l text-muted-foreground hover:text-danger transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="bg-surface mt-8 p-4 md:p-6 border border-border rounded-xl">
          <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-2 mb-4">
            <h2 className="font-bold text-lg">Meus Decks</h2>
            {!session && !authLoading && (
              <p className="text-muted-foreground text-xs">Entre na conta para salvar e visualizar seus decks.</p>
            )}
          </div>

          {isLoadingSavedDecks ? (
            <div className="flex justify-center py-6"><div className="border-primary border-t-2 rounded-full w-8 h-8 animate-spin"></div></div>
          ) : savedDecks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Voce ainda nao possui decks salvos.</p>
          ) : (
            <div className="space-y-2">
              {savedDecks.map((savedDeck) => (
                <div key={savedDeck.id} className="flex sm:flex-row flex-col justify-between sm:items-center gap-3 bg-background p-3 border border-border rounded-lg">
                  <div>
                    <p className="font-bold text-sm">{savedDeck.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Lider: {savedDeck.leaderName || 'Nao definido'} • {savedDeck.totalCards}/50 cartas • {new Date(savedDeck.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold ${savedDeck.isPublic ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warning'}`}>
                      {savedDeck.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {savedDeck.isPublic ? 'Publico' : 'Privado'}
                    </span>
                    <Link href={`/deckbuilder/${savedDeck.id}`} className="inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-md font-semibold text-primary text-xs transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Ver detalhes
                    </Link>
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
