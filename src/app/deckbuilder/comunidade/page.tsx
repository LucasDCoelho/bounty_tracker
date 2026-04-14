"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Eye, Globe, Search } from 'lucide-react';

type CommunityDeck = {
  id: string;
  name: string;
  authorName: string;
  totalCards: number;
  totalPrice: number;
  leaderName: string | null;
  createdAt: string;
};

type CommunityDeckRow = {
  deck_id: string;
  deck_name: string;
  created_at: string;
  author_display_name: string | null;
  leader_name: string | null;
  total_cards: number | null;
  total_price: number | null;
};

export default function CommunityPage() {
  const [decks, setDecks] = useState<CommunityDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchDeckName, setSearchDeckName] = useState('');
  const [searchAuthorName, setSearchAuthorName] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    const loadCommunityDecks = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .rpc('list_public_community_decks', { p_limit: 100, p_offset: 0 });

      if (error || !data || data.length === 0) {
        setDecks([]);
        setIsLoading(false);
        return;
      }

      const rows = data as CommunityDeckRow[];
      setDecks(
        rows.map((row) => ({
          id: row.deck_id,
          name: row.deck_name,
          authorName: row.author_display_name || 'Usuario',
          totalCards: Number(row.total_cards ?? 0),
          totalPrice: Number(row.total_price ?? 0),
          leaderName: row.leader_name,
          createdAt: row.created_at,
        }))
      );
      setIsLoading(false);
    };

    loadCommunityDecks();
  }, []);

  // Filtros aplicados
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const matchDeckName = searchDeckName === '' || deck.name.toLowerCase().includes(searchDeckName.toLowerCase());
      const matchAuthor = searchAuthorName === '' || deck.authorName.toLowerCase().includes(searchAuthorName.toLowerCase());

      const minVal = minPrice === '' ? 0 : Number(minPrice);
      const maxVal = maxPrice === '' ? Infinity : Number(maxPrice);
      const matchPrice = deck.totalPrice >= minVal && deck.totalPrice <= maxVal;

      return matchDeckName && matchAuthor && matchPrice;
    });
  }, [decks, searchDeckName, searchAuthorName, minPrice, maxPrice]);

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="flex sm:flex-row flex-col justify-between sm:items-center gap-3 mb-6">
          <Link href="/deckbuilder" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar ao Deckbuilder
          </Link>
          <h1 className="font-bold text-2xl">Decks da Comunidade</h1>
        </header>

        {/* Seção de Filtros */}
        <section className="bg-surface mb-6 p-4 md:p-6 border border-border rounded-xl">
          <h2 className="mb-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Filtros</h2>

          <div className="gap-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {/* Filtro: Nome do Deck */}
            <div>
              <label className="block mb-2 font-bold text-[10px] text-muted-foreground uppercase">Nome do Deck</label>
              <input
                type="text"
                placeholder="Ex: Luffy Gear 5"
                value={searchDeckName}
                onChange={(e) => setSearchDeckName(e.target.value)}
                className="bg-background px-3 py-2 border border-border focus:border-primary rounded-md outline-none w-full text-foreground text-sm"
              />
            </div>

            {/* Filtro: Autor */}
            <div>
              <label className="block mb-2 font-bold text-[10px] text-muted-foreground uppercase">Autor</label>
              <input
                type="text"
                placeholder="Nome do autor"
                value={searchAuthorName}
                onChange={(e) => setSearchAuthorName(e.target.value)}
                className="bg-background px-3 py-2 border border-border focus:border-primary rounded-md outline-none w-full text-foreground text-sm"
              />
            </div>

            {/* Filtro: Preço Mínimo */}
            <div>
              <label className="block mb-2 font-bold text-[10px] text-muted-foreground uppercase">Preço Mínimo (R$)</label>
              <input
                type="number"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
                step="50"
                className="bg-background px-3 py-2 border border-border focus:border-primary rounded-md outline-none w-full text-foreground text-sm"
              />
            </div>

            {/* Filtro: Preço Máximo */}
            <div>
              <label className="block mb-2 font-bold text-[10px] text-muted-foreground uppercase">Preço Máximo (R$)</label>
              <input
                type="number"
                placeholder="Sem limite"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
                step="50"
                className="bg-background px-3 py-2 border border-border focus:border-primary rounded-md outline-none w-full text-foreground text-sm"
              />
            </div>
          </div>

          <div className="mt-4 text-muted-foreground text-xs">
            Resultados: {filteredDecks.length} deck(s) encontrado(s)
          </div>
        </section>

        {/* Listagem de Decks */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="border-primary border-t-2 rounded-full w-12 h-12 animate-spin"></div>
          </div>
        ) : filteredDecks.length === 0 ? (
          <div className="bg-surface p-8 border border-border rounded-xl text-center">
            <Search className="mx-auto mb-4 w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhum deck encontrado com esses filtros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDecks.map((deck) => (
              <div key={deck.id} className="flex sm:flex-row flex-col justify-between sm:items-center gap-4 bg-surface p-4 border border-border hover:border-primary/50 rounded-xl transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg truncate">{deck.name}</h3>
                    <span className="inline-flex items-center gap-1 bg-success/10 px-2 py-0.5 border border-success/20 rounded font-bold text-[10px] text-success whitespace-nowrap">
                      <Globe className="w-3 h-3" /> Publico
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Autor: <span className="font-semibold text-foreground">{deck.authorName}</span> • Lider: {deck.leaderName || 'Nao definido'}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">{deck.totalCards}/50 cartas</span> • 
                    <span className="ml-2 font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deck.totalPrice)}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Criado em {new Date(deck.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <Link
                  href={`/deckbuilder/${deck.id}`}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 px-4 py-2 rounded-md font-bold text-primary-foreground text-sm whitespace-nowrap transition-colors"
                >
                  <Eye className="w-4 h-4" /> Ver Detalhes
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
