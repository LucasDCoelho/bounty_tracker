"use client";

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Trash2, Search, ArrowRightLeft, Percent } from 'lucide-react';

// Adicionamos o campo de desconto (discount) no modelo da carta
type Card = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  price: number;
  discount: number; 
};

type TradeSide = 'A' | 'B';

export default function Calculator() {
  const [leftCards, setLeftCards] = useState<Card[]>([]);
  const [rightCards, setRightCards] = useState<Card[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSide, setActiveSide] = useState<TradeSide>('A');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;

    setIsSearching(true);
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, card_number, image_url, price_history(price_avg)')
      .ilike('name', `%${searchTerm}%`)
      .limit(10);

    if (!error && data) {
      const formatted = data.map(c => ({
        id: c.id,
        name: c.name,
        card_number: c.card_number,
        image_url: c.image_url,
        price: c.price_history?.[0]?.price_avg || 0,
        discount: 20 // PRD: Padrão de 20% aplicado na hora da busca
      }));
      setSearchResults(formatted);
    }
    setIsSearching(false);
  };

  const addCard = (card: Card) => {
    if (activeSide === 'A') setLeftCards([...leftCards, card]);
    else setRightCards([...rightCards, card]);
    
    setSearchResults([]);
    setSearchTerm("");
  };

  const removeCard = (index: number, side: TradeSide) => {
    if (side === 'A') {
      const newCards = [...leftCards];
      newCards.splice(index, 1);
      setLeftCards(newCards);
    } else {
      const newCards = [...rightCards];
      newCards.splice(index, 1);
      setRightCards(newCards);
    }
  };

  // Função nova: Atualiza o desconto individual de uma carta
  const updateDiscount = (index: number, side: TradeSide, newDiscount: number) => {
    if (side === 'A') {
      const newCards = [...leftCards];
      newCards[index].discount = newDiscount;
      setLeftCards(newCards);
    } else {
      const newCards = [...rightCards];
      newCards[index].discount = newDiscount;
      setRightCards(newCards);
    }
  };

  // Calcula os totais aplicando o desconto matemático
  const totalA = leftCards.reduce((acc, card) => acc + (card.price * (1 - card.discount / 100)), 0);
  const totalB = rightCards.reduce((acc, card) => acc + (card.price * (1 - card.discount / 100)), 0);
  const diferenca = Math.abs(totalA - totalB);
  
  let resultadoMsg = "Troca Justa!";
  let resultadoCor = "text-slate-400";
  if (totalA > totalB) {
    resultadoMsg = `Lado B volta R$ ${diferenca.toFixed(2)}`;
    resultadoCor = "text-emerald-400";
  } else if (totalB > totalA) {
    resultadoMsg = `Lado A volta R$ ${diferenca.toFixed(2)}`;
    resultadoCor = "text-orange-500";
  }

  // Componente interno para não repetir código visual da linha da carta
  const CardRow = ({ card, index, side }: { card: Card, index: number, side: TradeSide }) => {
    const finalPrice = card.price * (1 - card.discount / 100);
    
    return (
      <div className="flex justify-between items-center bg-slate-950 p-3 border border-slate-800 rounded-lg">
        <div className="flex items-center gap-3 w-full">
          <img src={card.image_url} alt={card.name} className="shadow-md rounded w-12 h-16 object-cover" />
          <div className="flex-1">
            <p className="pr-2 font-bold text-sm truncate" title={card.name}>{card.name}</p>
            <p className="text-slate-500 text-xs line-through">R$ {card.price.toFixed(2)}</p>
            <p className="font-bold text-emerald-400 text-lg">R$ {finalPrice.toFixed(2)}</p>
          </div>
          
          {/* Input de Desconto Granular com uso de polegar (Mobile-First) */}
          <div className="flex flex-col items-center mr-2">
            <label className="flex items-center gap-1 mb-1 text-[10px] text-slate-400 uppercase tracking-widest">
              Desc <Percent className="w-3 h-3" />
            </label>
            <input 
              type="number" 
              value={card.discount}
              onChange={(e) => updateDiscount(index, side, Number(e.target.value))}
              className="bg-slate-900 p-1 border border-slate-700 focus:border-orange-500 rounded outline-none w-14 font-bold text-amber-500 text-center"
            />
          </div>
        </div>
        
        <button onClick={() => removeCard(index, side)} className="ml-2 p-2 border-slate-800 border-l text-slate-600 hover:text-red-500 transition-colors">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    );
  };

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="flex justify-between items-center mb-6">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Link>
          <h1 className="flex items-center gap-2 bg-clip-text bg-gradient-to-r from-orange-500 to-amber-300 font-bold text-transparent text-xl md:text-2xl">
            Calculadora de Feira <ArrowRightLeft className="w-5 h-5 text-orange-500" />
          </h1>
        </header>

        {/* Placar de Diferença (Sticky) */}
        <div className="top-4 z-10 sticky bg-slate-900 shadow-2xl mb-6 p-4 border border-slate-800 rounded-xl text-center">
          <p className="mb-1 text-slate-400 text-xs md:text-sm uppercase tracking-widest">Resultado Final</p>
          <p className={`text-2xl md:text-3xl font-black ${resultadoCor}`}>
            {resultadoMsg}
          </p>
        </div>

        {/* Barra de Busca Mobile-First */}
        <div className="bg-slate-900 mb-6 p-4 border border-slate-800 rounded-xl">
          <div className="flex flex-col gap-4">
            <div className="flex bg-slate-950 p-1 border border-slate-700 rounded-lg w-full">
              <button 
                onClick={() => setActiveSide('A')}
                className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${activeSide === 'A' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Para Lado A
              </button>
              <button 
                onClick={() => setActiveSide('B')}
                className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${activeSide === 'B' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Para Lado B
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex">
              <input 
                type="text" 
                placeholder="Buscar carta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 px-4 py-3 border border-slate-700 focus:border-orange-500 rounded-l-md outline-none w-full text-white"
              />
              <button type="submit" className="flex justify-center items-center bg-slate-800 hover:bg-slate-700 px-6 border border-slate-700 border-l-0 rounded-r-md transition-colors">
                {isSearching ? <div className="border-orange-500 border-t-2 rounded-full w-5 h-5 animate-spin"></div> : <Search className="w-5 h-5 text-orange-500" />}
              </button>
            </form>
          </div>

          {/* Resultados */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-2 mt-4 pr-2 max-h-60 overflow-y-auto custom-scrollbar">
              {searchResults.map(card => (
                <div key={card.id} className="flex justify-between items-center bg-slate-950 p-2 border border-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img src={card.image_url} alt={card.name} className="rounded w-10 h-14 object-cover" />
                    <div>
                      <p className="max-w-[180px] font-bold text-sm truncate">{card.name}</p>
                      <p className="text-slate-500 text-xs">R$ {card.price.toFixed(2)} (Ref)</p>
                    </div>
                  </div>
                  <button onClick={() => addCard(card)} className="bg-emerald-600/20 hover:bg-emerald-600 p-3 rounded-md text-emerald-500 hover:text-white transition-colors">
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colunas da Troca */}
        <div className="gap-6 grid grid-cols-1 md:grid-cols-2">
          <div className="flex flex-col bg-slate-900 p-4 border border-slate-800 rounded-xl h-full">
            <div className="flex justify-between items-center mb-4 pb-4 border-slate-800 border-b">
              <h2 className="font-bold text-orange-500 text-lg">Lado A</h2>
              <span className="font-black text-white text-xl">R$ {totalA.toFixed(2)}</span>
            </div>
            <div className="flex-1 space-y-3">
              {leftCards.length === 0 ? <p className="py-6 text-slate-500 text-sm text-center">Vazio</p> : leftCards.map((card, idx) => <CardRow key={idx} card={card} index={idx} side="A" />)}
            </div>
          </div>

          <div className="flex flex-col bg-slate-900 p-4 border border-slate-800 rounded-xl h-full">
            <div className="flex justify-between items-center mb-4 pb-4 border-slate-800 border-b">
              <h2 className="font-bold text-indigo-400 text-lg">Lado B</h2>
              <span className="font-black text-white text-xl">R$ {totalB.toFixed(2)}</span>
            </div>
            <div className="flex-1 space-y-3">
              {rightCards.length === 0 ? <p className="py-6 text-slate-500 text-sm text-center">Vazio</p> : rightCards.map((card, idx) => <CardRow key={idx} card={card} index={idx} side="B" />)}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}