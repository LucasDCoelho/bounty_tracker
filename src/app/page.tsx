"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/telemetry';
import { ArrowRightLeft, TrendingUp, TrendingDown, Minus, Layers, Wallet, Store, Calendar, Zap } from 'lucide-react';

type Card = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  rarity: string;
  set_id: string;
  price_history: { price_avg: number; created_at: string }[];
};

type SetInfo = {
  id: string;
  code: string;
  name: string;
};

export default function Home() {
  const [cards, setCards] = useState<Card[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const fetchSets = async () => {
    const { data } = await supabase.from('sets').select('id, code, name').order('code');
    if (data) setSets(data);
  };

  const fetchMarketData = async (pageOverride = page) => {
    setIsLoading(true);
    const from = (pageOverride - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('cards')
      .select(`
        id, name, card_number, image_url, rarity, set_id,
        price_history ( price_avg, created_at )
      `, { count: 'exact' });

    if (searchTerm) query = query.ilike('name', `%${searchTerm}%`);
    if (selectedSet) query = query.eq('set_id', selectedSet);

    const { data, count, error } = await query
      .order('card_number', { ascending: true })
      .range(from, to);

    if (!error) {
      setCards(data as Card[]);
      setTotalCount(count ?? 0);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchSets(); }, []);
  useEffect(() => {
    trackEvent({
      eventName: 'market_view',
      properties: {
        page,
        selectedSet: selectedSet || 'all',
      },
    });

    fetchMarketData();
  }, [page, selectedSet]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    trackEvent({
      eventName: 'market_search',
      properties: {
        query: searchTerm || '',
        selectedSet: selectedSet || 'all',
      },
    });
    fetchMarketData(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <header className="mx-auto mb-10 max-w-7xl">
        <div className="flex md:flex-row flex-col justify-between md:items-center gap-6 bg-surface/75 shadow-black/5 shadow-xl backdrop-blur-sm p-6 border border-border rounded-4xl">
          <div>
            <h1 className="bg-clip-text bg-linear-to-r from-primary to-secondary font-extrabold text-transparent text-4xl">
              BountyTracker
            </h1>
            <p className="mt-1 text-muted-foreground">Mercado em tempo real de One Piece TCG</p>

            <div className="flex flex-wrap gap-3 mt-4">
              <Link href="/calculadora" className="inline-flex items-center gap-2 bg-background hover:bg-accent px-4 py-2 border border-border rounded-lg font-bold text-primary text-sm transition-all">
                <ArrowRightLeft className="w-4 h-4" />
                Calculadora
              </Link>
              <Link href="/deckbuilder" className="inline-flex items-center gap-2 bg-background hover:bg-accent px-4 py-2 border border-border rounded-lg font-bold text-secondary text-sm transition-all">
                <Layers className="w-4 h-4" />
                Deckbuilder
              </Link>
              <Link href="/carteira" className="inline-flex items-center gap-2 bg-background hover:bg-accent px-4 py-2 border border-border rounded-lg font-bold text-success text-sm transition-all">
                <Wallet className="w-4 h-4" />
                Minha Carteira
              </Link>
              <Link href="/buylist" className="inline-flex items-center gap-2 bg-background hover:bg-accent px-4 py-2 border border-border rounded-lg font-bold text-warning text-sm transition-all">
                <Store className="w-4 h-4" />
                Buylist Lojas
              </Link>
              <Link href="/radar" className="inline-flex items-center gap-2 bg-background hover:bg-accent px-4 py-2 border border-border rounded-lg font-bold text-info text-sm transition-all">
                <Calendar className="w-4 h-4" />
                Radar de Torneios
              </Link>
              <Link href="/scanner" className="inline-flex items-center gap-2 bg-background hover:bg-accent px-4 py-2 border border-border rounded-lg font-bold text-primary text-sm transition-all">
                <Zap className="w-4 h-4" />
                Abrir Scanner (BETA)
              </Link>
            </div>
          </div>

          <div className="flex md:flex-row flex-col gap-3 w-full md:max-w-xl">
            <select
              value={selectedSet}
              onChange={(e) => { setSelectedSet(e.target.value); setPage(1); }}
              className="bg-background px-4 py-2 border border-border focus:border-primary rounded-md outline-none w-full md:w-auto md:min-w-55 text-foreground"
            >
              <option value="">Todas as Coleções</option>
              {sets.map(s => (
                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
              ))}
            </select>

            <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-0">
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-background px-4 py-2 border border-border focus:border-primary rounded-l-md outline-none w-full min-w-0 text-foreground"
              />
              <button type="submit" className="bg-primary hover:bg-primary/90 px-4 py-2 rounded-r-md font-bold text-primary-foreground whitespace-nowrap transition-colors">
                Buscar
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl">
        <div className="gap-3 grid grid-cols-1 md:grid-cols-3 mb-8">
          <Link href="/calculadora" className="group bg-success/10 hover:bg-success/15 p-4 border border-success/20 rounded-xl transition-all">
            <p className="font-black text-success text-sm uppercase tracking-wider">Quero negociar agora</p>
            <p className="mt-1 text-muted-foreground text-sm">Abra a Calculadora com desconto por carta para fechar troca no balcão.</p>
          </Link>
          <Link href="/deckbuilder" className="group bg-secondary/10 hover:bg-secondary/15 p-4 border border-secondary/20 rounded-xl transition-all">
            <p className="font-black text-secondary text-sm uppercase tracking-wider">Quero montar deck</p>
            <p className="mt-1 text-muted-foreground text-sm">Construa 50 + líder com validação de cópias para não errar na montagem.</p>
          </Link>
          <Link href="/radar" className="group bg-primary/10 hover:bg-primary/15 p-4 border border-primary/20 rounded-xl transition-all">
            <p className="font-black text-primary text-sm uppercase tracking-wider">Quero jogar hoje</p>
            <p className="mt-1 text-muted-foreground text-sm">Veja torneios locais e entre em contato direto com a loja via WhatsApp.</p>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="border-primary border-t-2 rounded-full w-12 h-12 animate-spin"></div></div>
        ) : (
          <>
            <div className="gap-4 md:gap-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              {cards.map((card) => {
                // 1. Organiza o histórico de preços do mais novo para o mais antigo
                const sortedHistory = card.price_history?.sort((a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ) || [];

                // 2. Extrai o preço atual e o preço anterior
                const currentPrice = sortedHistory[0]?.price_avg || 0;
                const previousPrice = sortedHistory[1]?.price_avg || currentPrice;

                // 3. Calcula o Yield (Porcentagem de variação)
                let yieldPct = 0;
                if (previousPrice > 0) {
                  yieldPct = ((currentPrice - previousPrice) / previousPrice) * 100;
                }

                const isPositive = yieldPct > 0;
                const isNegative = yieldPct < 0;

                return (
                  <Link href={`/carta/${card.id}`} key={card.id} className="group block bg-surface p-3 border border-border hover:border-primary/50 rounded-xl transition-all cursor-pointer">
                    <div className="relative">
                      <img src={card.image_url} alt={card.name} className="shadow-md mb-3 rounded-lg w-full group-hover:scale-[1.02] transition-transform duration-300" />
                      {/* Badge de Raridade */}
                      <div className="top-1 left-1 absolute bg-background/90 backdrop-blur-sm px-2 py-0.5 border border-primary/20 rounded font-bold text-[10px] text-primary">
                        {card.rarity || 'UNK'}
                      </div>
                    </div>

                    <p className="font-mono text-[10px] text-muted-foreground">{card.card_number}</p>
                    <h2 className="font-bold text-foreground text-sm truncate" title={card.name}>{card.name}</h2>

                    <div className="flex justify-between items-end mt-3">
                      <div>
                        <p className="mb-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">Preço (Liga)</p>
                        <p className="font-black text-foreground text-lg">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentPrice)}
                        </p>
                      </div>

                      {/* Indicador de Yield (%) */}
                      <div className={`flex items-center gap-1 text-[11px] font-bold px-1.5 py-1 rounded border ${isPositive ? 'bg-success/10 text-success border-success/20' : isNegative ? 'bg-danger/10 text-danger border-danger/20' : 'bg-muted text-muted-foreground border-border'}`}>
                        {isPositive && <TrendingUp className="w-3 h-3" />}
                        {isNegative && <TrendingDown className="w-3 h-3" />}
                        {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
                        {Math.abs(yieldPct).toFixed(1)}%
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="flex flex-col items-center gap-4 mt-12 pt-8 border-border border-t">
              <p className="text-muted-foreground text-sm">Mostrando {cards.length} de {totalCount} cartas</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="bg-surface hover:bg-accent disabled:opacity-30 px-4 py-2 rounded-md transition-colors">Anterior</button>
                <div className="flex items-center px-4 font-bold text-primary">Página {page} de {totalPages}</div>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="bg-surface hover:bg-accent disabled:opacity-30 px-4 py-2 rounded-md transition-colors">Próxima</button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}