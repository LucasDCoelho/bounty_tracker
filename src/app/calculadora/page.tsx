"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { clearTradeSession, consumeTradeQueue, loadTradeSession, saveTradeSession } from '@/lib/flow-bridge';
import { trackEvent } from '@/lib/telemetry';
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

type TradeSnapshot = {
  leftCards: Card[];
  rightCards: Card[];
  activeSide: TradeSide;
};

export default function Calculator() {
  const [leftCards, setLeftCards] = useState<Card[]>([]);
  const [rightCards, setRightCards] = useState<Card[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSide, setActiveSide] = useState<TradeSide>('A');
  const [history, setHistory] = useState<TradeSnapshot[]>([]);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [undoToast, setUndoToast] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  const addCardToSide = (card: Card, side: TradeSide) => {
    if (side === 'A') setLeftCards((prev) => [...prev, card]);
    else setRightCards((prev) => [...prev, card]);
  };

  const pushHistory = (actionLabel?: string) => {
    setHistory((prev) => [
      ...prev,
      {
        leftCards,
        rightCards,
        activeSide,
      },
    ].slice(-30));

    if (actionLabel) {
      setActionLog((prev) => [actionLabel, ...prev].slice(0, 8));
    }
  };

  const normalizeBridgeCard = (item: {
    id: string;
    name: string;
    card_number: string;
    image_url: string;
    price: number;
    discount?: number;
  }): Card => ({
    id: item.id,
    name: item.name,
    card_number: item.card_number,
    image_url: item.image_url,
    price: item.price,
    discount: item.discount ?? 20,
  });

  useEffect(() => {
    setSource(new URLSearchParams(window.location.search).get('source'));
    trackEvent({
      eventName: 'trade_calculator_view',
      properties: {
        source: new URLSearchParams(window.location.search).get('source') || 'direct',
      },
    });

    const savedSession = loadTradeSession();
    if (savedSession) {
      setLeftCards(savedSession.leftCards.map((item) => normalizeBridgeCard(item)));
      setRightCards(savedSession.rightCards.map((item) => normalizeBridgeCard(item)));
      setActiveSide(savedSession.activeSide ?? 'A');
    }

    const queuedCards = consumeTradeQueue();
    if (!queuedCards.length) return;

    queuedCards.forEach((item) => {
      addCardToSide(normalizeBridgeCard(item), item.side ?? 'A');
    });

    setActiveSide(queuedCards[queuedCards.length - 1]?.side ?? 'A');
  }, []);

  useEffect(() => {
    if (!leftCards.length && !rightCards.length) {
      clearTradeSession();
      return;
    }

    saveTradeSession({
      leftCards,
      rightCards,
      activeSide,
    });
  }, [leftCards, rightCards, activeSide]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
      if (!isUndo) return;

      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isEditing) return;
      event.preventDefault();
      undoLastAction();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history]);

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
    pushHistory(`Adicionou ${card.name}`);
    trackEvent({
      eventName: 'trade_card_added',
      properties: {
        cardId: card.id,
        cardName: card.name,
        side: activeSide,
      },
    });
    addCardToSide(card, activeSide);
    
    setSearchResults([]);
    setSearchTerm("");
  };

  const removeCard = (index: number, side: TradeSide) => {
    const selectedCard = side === 'A' ? leftCards[index] : rightCards[index];
    if (!selectedCard) return;

    pushHistory(`Removeu ${selectedCard.name}`);
    trackEvent({
      eventName: 'trade_card_removed',
      properties: {
        cardId: selectedCard.id,
        cardName: selectedCard.name,
        side,
      },
    });

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

  const moveCardToOtherSide = (index: number, side: TradeSide) => {
    if (side === 'A') {
      const card = leftCards[index];
      if (!card) return;
      pushHistory(`Moveu ${card.name} para Lado B`);
      trackEvent({
        eventName: 'trade_card_moved',
        properties: {
          cardId: card.id,
          cardName: card.name,
          from: 'A',
          to: 'B',
        },
      });
      setLeftCards((prev) => prev.filter((_, i) => i !== index));
      setRightCards((prev) => [...prev, card]);
      setActiveSide('B');
      return;
    }

    const card = rightCards[index];
    if (!card) return;
    pushHistory(`Moveu ${card.name} para Lado A`);
    trackEvent({
      eventName: 'trade_card_moved',
      properties: {
        cardId: card.id,
        cardName: card.name,
        from: 'B',
        to: 'A',
      },
    });
    setRightCards((prev) => prev.filter((_, i) => i !== index));
    setLeftCards((prev) => [...prev, card]);
    setActiveSide('A');
  };

  const clearTrade = () => {
    const hasState = leftCards.length > 0 || rightCards.length > 0 || searchTerm.length > 0;
    if (!hasState) return;

    pushHistory('Limpou a troca');
    trackEvent({
      eventName: 'trade_cleared',
      properties: {
        leftCount: leftCards.length,
        rightCount: rightCards.length,
      },
    });
    setLeftCards([]);
    setRightCards([]);
    setSearchResults([]);
    setSearchTerm('');
    setActiveSide('A');
    clearTradeSession();
  };

  // Função nova: Atualiza o desconto individual de uma carta
  const updateDiscount = (index: number, side: TradeSide, newDiscount: number) => {
    const selectedCard = side === 'A' ? leftCards[index] : rightCards[index];
    if (!selectedCard) return;
    if (selectedCard.discount === newDiscount) return;

    pushHistory(`Ajustou desconto de ${selectedCard.name}`);
    trackEvent({
      eventName: 'trade_discount_changed',
      properties: {
        cardId: selectedCard.id,
        cardName: selectedCard.name,
        side,
        newDiscount,
      },
    });

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

  const undoLastAction = () => {
    const lastSnapshot = history[history.length - 1];
    if (!lastSnapshot) return;

    setLeftCards(lastSnapshot.leftCards);
    setRightCards(lastSnapshot.rightCards);
    setActiveSide(lastSnapshot.activeSide);
    trackEvent({
      eventName: 'trade_undo',
      properties: {
        historyDepth: history.length,
      },
    });
    setHistory((prev) => prev.slice(0, -1));
    setUndoToast(true);
    setActionLog((prev) => ['Desfez a última ação', ...prev].slice(0, 8));

    window.setTimeout(() => {
      setUndoToast(false);
    }, 1400);
  };

  // Calcula os totais aplicando o desconto matemático
  const totalA = leftCards.reduce((acc, card) => acc + (card.price * (1 - card.discount / 100)), 0);
  const totalB = rightCards.reduce((acc, card) => acc + (card.price * (1 - card.discount / 100)), 0);
  const diferenca = Math.abs(totalA - totalB);
  
  let resultadoMsg = "Troca Justa!";
  let resultadoCor = "text-muted-foreground";
  if (totalA > totalB) {
    resultadoMsg = `Lado B volta R$ ${diferenca.toFixed(2)}`;
    resultadoCor = "text-success";
  } else if (totalB > totalA) {
    resultadoMsg = `Lado A volta R$ ${diferenca.toFixed(2)}`;
    resultadoCor = "text-primary";
  }

  // Componente interno para não repetir código visual da linha da carta
  const CardRow = ({ card, index, side }: { card: Card, index: number, side: TradeSide }) => {
    const finalPrice = card.price * (1 - card.discount / 100);
    const moveLabel = side === 'A' ? 'Mover para Lado B' : 'Mover para Lado A';
    
    return (
      <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-3 bg-background p-3 border border-border rounded-lg">
        <div className="flex items-center gap-3 w-full min-w-0">
          <img src={card.image_url} alt={card.name} className="shadow-md rounded w-10 sm:w-12 h-14 sm:h-16 object-cover" />
          <div className="flex-1 min-w-0">
            <p className="pr-2 font-bold text-sm truncate" title={card.name}>{card.name}</p>
            <p className="text-muted-foreground text-xs line-through">R$ {card.price.toFixed(2)}</p>
            <p className="font-bold text-success text-lg">R$ {finalPrice.toFixed(2)}</p>
          </div>
          
          {/* Input de Desconto Granular com uso de polegar (Mobile-First) */}
          <div className="flex flex-col items-center mr-1 sm:mr-2 shrink-0">
            <label className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground uppercase tracking-widest">
              Desc <Percent className="w-3 h-3" />
            </label>
            <input 
              type="number" 
              value={card.discount}
              onChange={(e) => updateDiscount(index, side, Number(e.target.value))}
              className="bg-surface p-1 border border-border focus:border-primary rounded outline-none w-12 sm:w-14 font-bold text-primary text-center"
            />
          </div>
        </div>
        
        <div className="flex justify-end sm:justify-start items-center gap-1 sm:ml-2 pt-2 sm:pt-0 border-border border-t sm:border-t-0 sm:border-l">
          <button
            onClick={() => moveCardToOtherSide(index, side)}
            title={moveLabel}
            className="p-2 text-muted-foreground hover:text-secondary transition-colors"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>
          <button onClick={() => removeCard(index, side)} className="p-2 text-muted-foreground hover:text-danger transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 mb-6">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Link>
          <h1 className="flex items-center gap-2 bg-clip-text bg-linear-to-r from-primary to-secondary font-bold text-transparent text-xl md:text-2xl">
            Calculadora de Feira <ArrowRightLeft className="w-5 h-5 text-primary" />
          </h1>
        </header>

        {source && (
          <div className="bg-success/10 mb-4 px-4 py-2 border border-success/20 rounded-lg text-success text-xs">
            Carta recebida do fluxo: <span className="font-bold uppercase">{source}</span>
          </div>
        )}

        {/* Placar de Diferença (Sticky) */}
        <div className="top-4 z-10 sticky bg-surface shadow-2xl shadow-black/10 mb-6 p-4 border border-border rounded-xl text-center">
          <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-2">
            <p className="text-muted-foreground text-xs md:text-sm uppercase tracking-widest">Resultado Final</p>
            <div className="flex justify-center sm:justify-end gap-2">
              <button
                onClick={undoLastAction}
                disabled={history.length === 0}
                className="bg-background hover:bg-accent disabled:opacity-40 px-3 py-1 rounded-md font-bold text-[10px] text-muted-foreground uppercase tracking-wider transition-colors"
              >
                Desfazer
              </button>
              <button
                onClick={clearTrade}
                className="bg-background hover:bg-accent px-3 py-1 rounded-md font-bold text-[10px] text-muted-foreground uppercase tracking-wider transition-colors"
              >
                Limpar Troca
              </button>
            </div>
          </div>
          <p className={`text-2xl md:text-3xl font-black ${resultadoCor}`}>
            {resultadoMsg}
          </p>

          {actionLog.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {actionLog.slice(0, 4).map((action, idx) => (
                <span key={`${action}-${idx}`} className="bg-muted px-2 py-1 border border-border rounded-md text-[10px] text-muted-foreground">
                  {action}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Barra de Busca Mobile-First */}
        <div className="bg-surface mb-6 p-4 border border-border rounded-xl">
          <div className="flex flex-col gap-4">
            <div className="flex bg-background p-1 border border-border rounded-lg w-full">
              <button 
                onClick={() => setActiveSide('A')}
                className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${activeSide === 'A' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Para Lado A
              </button>
              <button 
                onClick={() => setActiveSide('B')}
                className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${activeSide === 'B' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
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
                className="bg-background px-4 py-3 border border-border focus:border-primary rounded-l-md outline-none w-full text-foreground"
              />
              <button type="submit" className="flex justify-center items-center bg-background hover:bg-accent px-6 border border-border border-l-0 rounded-r-md transition-colors">
                {isSearching ? <div className="border-primary border-t-2 rounded-full w-5 h-5 animate-spin"></div> : <Search className="w-5 h-5 text-primary" />}
              </button>
            </form>
          </div>

          {/* Resultados */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-2 mt-4 pr-2 max-h-60 overflow-y-auto custom-scrollbar">
              {searchResults.map(card => (
                <div key={card.id} className="flex justify-between items-center bg-background p-2 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <img src={card.image_url} alt={card.name} className="rounded w-10 h-14 object-cover" />
                    <div>
                      <p className="max-w-45 font-bold text-sm truncate">{card.name}</p>
                      <p className="text-muted-foreground text-xs">R$ {card.price.toFixed(2)} (Ref)</p>
                    </div>
                  </div>
                  <button onClick={() => addCard(card)} className="bg-success/20 hover:bg-success p-3 rounded-md text-success hover:text-success-foreground transition-colors">
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colunas da Troca */}
        <div className="gap-6 grid grid-cols-1 md:grid-cols-2">
          <div className="flex flex-col bg-surface p-4 border border-border rounded-xl h-full">
            <div className="flex justify-between items-center mb-4 pb-4 border-border border-b">
              <h2 className="font-bold text-primary text-lg">Lado A</h2>
              <span className="font-black text-foreground text-xl">R$ {totalA.toFixed(2)}</span>
            </div>
            <div className="flex-1 space-y-3">
              {leftCards.length === 0 ? <p className="py-6 text-muted-foreground text-sm text-center">Vazio</p> : leftCards.map((card, idx) => <CardRow key={idx} card={card} index={idx} side="A" />)}
            </div>
          </div>

          <div className="flex flex-col bg-surface p-4 border border-border rounded-xl h-full">
            <div className="flex justify-between items-center mb-4 pb-4 border-border border-b">
              <h2 className="font-bold text-secondary text-lg">Lado B</h2>
              <span className="font-black text-foreground text-xl">R$ {totalB.toFixed(2)}</span>
            </div>
            <div className="flex-1 space-y-3">
              {rightCards.length === 0 ? <p className="py-6 text-muted-foreground text-sm text-center">Vazio</p> : rightCards.map((card, idx) => <CardRow key={idx} card={card} index={idx} side="B" />)}
            </div>
          </div>
        </div>
      </div>

      {undoToast && (
        <div className="right-4 bottom-4 z-20 fixed bg-success/15 px-3 py-2 border border-success/30 rounded-lg text-success text-xs">
          Acao desfeita
        </div>
      )}
    </main>
  );
}