"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { consumePendingDeckCard } from '@/lib/flow-bridge';
import { ArrowLeft, Search, Plus, Minus, Trash2, Layers } from 'lucide-react';

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

export default function Deckbuilder() {
  const searchParams = useSearchParams();
  const [leader, setLeader] = useState<Card | null>(null);
  const [deck, setDeck] = useState<DeckItem[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const source = searchParams.get('source');

  useEffect(() => {
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;

    setIsSearching(true);
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, card_number, image_url, rarity, price_history(price_avg)')
      .ilike('name', `%${searchTerm}%`)
      .limit(15);

    if (!error && data) {
      const formatted = data.map(c => ({
        id: c.id,
        name: c.name,
        card_number: c.card_number,
        image_url: c.image_url,
        rarity: c.rarity,
        price: c.price_history?.[0]?.price_avg || 0
      }));
      setSearchResults(formatted);
    }
    setIsSearching(false);
  };

  const totalCards = deck.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = deck.reduce((acc, item) => acc + (item.card.price * item.quantity), 0) + (leader?.price || 0);

  const addCard = (card: Card) => {
    // Regra 1: Se for um Líder (Raridade L), vai para o slot de Líder
    if (card.rarity === 'L') {
      setLeader(card);
      return;
    }

    // Regra 2: Limite de 50 cartas no deck principal
    if (totalCards >= 50) {
      alert("O deck já atingiu o limite de 50 cartas!");
      return;
    }

    const existingItem = deck.find(item => item.card.card_number === card.card_number);

    // Regra 3: Limite de 4 cópias por carta
    if (existingItem && existingItem.quantity >= 4) {
      alert("Você só pode ter no máximo 4 cópias da mesma carta!");
      return;
    }

    if (existingItem) {
      setDeck(deck.map(item => 
        item.card.card_number === card.card_number 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setDeck([...deck, { card, quantity: 1 }]);
    }
  };

  const removeCard = (cardNumber: string, removeAll: boolean = false) => {
    const existingItem = deck.find(item => item.card.card_number === cardNumber);
    if (!existingItem) return;

    if (existingItem.quantity > 1 && !removeAll) {
      setDeck(deck.map(item => 
        item.card.card_number === cardNumber 
          ? { ...item, quantity: item.quantity - 1 } 
          : item
      ));
    } else {
      setDeck(deck.filter(item => item.card.card_number !== cardNumber));
    }
  };

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="flex justify-between items-center mb-6">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Link>
          <h1 className="flex items-center gap-2 bg-clip-text bg-linear-to-r from-orange-500 to-amber-300 font-bold text-transparent text-2xl">
            Deckbuilder <Layers className="w-6 h-6 text-orange-500" />
          </h1>
        </header>

        {source && (
          <div className="bg-indigo-500/10 mb-4 px-4 py-2 border border-indigo-500/20 rounded-lg text-indigo-300 text-xs">
            Carta recebida do fluxo: <span className="font-bold uppercase">{source}</span>
          </div>
        )}

        <div className="gap-8 grid grid-cols-1 lg:grid-cols-12">
          
          {/* Coluna Esquerda: Busca e Resultados */}
          <div className="flex flex-col lg:col-span-5 bg-slate-900 p-4 border border-slate-800 rounded-xl lg:h-[80vh]">
            <form onSubmit={handleSearch} className="flex mb-4">
              <input 
                type="text" 
                placeholder="Buscar cartas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 px-4 py-3 border border-slate-700 focus:border-orange-500 rounded-l-md outline-none w-full text-white"
              />
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 px-6 border border-slate-700 border-l-0 rounded-r-md transition-colors">
                {isSearching ? <div className="border-orange-500 border-t-2 rounded-full w-5 h-5 animate-spin"></div> : <Search className="w-5 h-5 text-orange-500" />}
              </button>
            </form>

            <div className="flex-1 space-y-2 pr-2 overflow-y-auto custom-scrollbar">
              {searchResults.length === 0 && !isSearching && (
                <p className="mt-10 text-slate-500 text-center">Pesquise por nome para adicionar cartas</p>
              )}
              {searchResults.map(card => (
                <div key={card.id} className="group flex justify-between items-center bg-slate-950 p-2 border border-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img src={card.image_url} alt={card.name} className="shadow-sm rounded w-12 h-16 object-cover" />
                    <div>
                      <p className="max-w-37.5 font-bold text-sm truncate">{card.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-500/10 px-1.5 py-0.5 rounded font-bold text-[10px] text-amber-500">{card.rarity}</span>
                        <span className="text-slate-500 text-xs">{card.card_number}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => addCard(card)} 
                    className="bg-slate-800 hover:bg-orange-600 p-2 rounded-md text-slate-300 hover:text-white transition-colors"
                    title={card.rarity === 'L' ? "Definir como Líder" : "Adicionar ao Deck"}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna Direita: O Deck Montado */}
          <div className="flex flex-col lg:col-span-7 bg-slate-900 p-4 border border-slate-800 rounded-xl lg:h-[80vh]">
            
            {/* Stats do Deck */}
            <div className="flex justify-between items-center bg-slate-950 mb-6 p-4 border border-slate-800 rounded-lg">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-widest">Cartas</p>
                <p className={`text-2xl font-black ${totalCards === 50 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {totalCards} / 50
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs uppercase tracking-widest">Valor do Deck</p>
                <p className="font-black text-orange-500 text-2xl">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-6 pr-2 overflow-y-auto custom-scrollbar">
              
              {/* Seção Líder */}
              <div>
                <h3 className="flex justify-between items-center mb-2 font-bold text-slate-400 text-sm uppercase tracking-wider">
                  <span>Líder (1/1)</span>
                  {leader && <button onClick={() => setLeader(null)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>}
                </h3>
                {leader ? (
                  <div className="flex items-center gap-4 bg-slate-950 p-3 border border-orange-500/30 rounded-lg">
                    <img src={leader.image_url} alt={leader.name} className="shadow-md rounded w-16 h-24 object-cover" />
                    <div>
                      <p className="font-bold text-white text-lg">{leader.name}</p>
                      <p className="text-slate-500 text-sm">{leader.card_number}</p>
                      <p className="mt-1 font-bold text-emerald-400">R$ {leader.price.toFixed(2)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center items-center bg-slate-950 border border-slate-700 border-dashed rounded-lg h-24 text-slate-500">
                    Nenhum líder selecionado
                  </div>
                )}
              </div>

              {/* Seção Main Deck */}
              <div>
                <h3 className="mb-2 font-bold text-slate-400 text-sm uppercase tracking-wider">
                  Deck Principal ({totalCards})
                </h3>
                {deck.length === 0 ? (
                  <p className="py-6 text-slate-600 text-center">Adicione cartas da busca para começar a montar seu deck.</p>
                ) : (
                  <div className="space-y-2">
                    {deck.map(item => (
                      <div key={item.card.card_number} className="flex justify-between items-center bg-slate-950 p-2 border border-slate-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <img src={item.card.image_url} alt={item.card.name} className="rounded w-10 h-14 object-cover" />
                          <div>
                            <p className="max-w-50 font-bold text-sm truncate">{item.card.name}</p>
                            <p className="text-slate-500 text-xs">{item.card.card_number} • R$ {item.card.price.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        {/* Controles de Quantidade */}
                        <div className="flex items-center gap-3 bg-slate-900 p-1 border border-slate-700 rounded-md">
                          <button onClick={() => removeCard(item.card.card_number)} className="p-1 hover:text-red-400 transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-4 font-black text-center">{item.quantity}</span>
                          <button onClick={() => addCard(item.card)} className="disabled:opacity-30 p-1 hover:text-emerald-400 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeCard(item.card.card_number, true)} className="ml-1 p-1 pl-2 border-slate-700 border-l text-slate-600 hover:text-red-500 transition-colors">
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
      </div>
    </main>
  );
}