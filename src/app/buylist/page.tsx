"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Store, Search, TrendingDown, MessageCircle, AlertTriangle } from 'lucide-react';

type BuylistOffer = {
  id: string;
  buy_percentage: number;
  payment_method: string;
  store: { 
    name: string; 
    whatsapp: string; // Corrigido de contact para whatsapp
  };
  card: {
    name: string;
    card_number: string;
    image_url: string;
    price_history: { price_avg: number; created_at: string }[];
  };
};

export default function BuylistPanel() {
  const [offers, setOffers] = useState<BuylistOffer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchOffers = async () => {
    setIsLoading(true);
    
    // Corrigido: buscamos 'whatsapp' em vez de 'contact'
    const { data, error } = await supabase
      .from('store_buylists')
      .select(`
        id, 
        buy_percentage, 
        payment_method,
        store:stores ( name, whatsapp ), 
        card:cards (
          name, 
          card_number, 
          image_url,
          price_history ( price_avg, created_at )
        )
      `)
      .eq('is_active', true);

    if (error) {
      console.error("Erro na Buylist:", error.message);
    }

    if (data) {
      // Ordenação e formatação dos dados
      const formatted = data.map((item: any) => ({
        ...item,
        card: {
          ...item.card,
          price_history: (item.card.price_history || []).sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }
      }));
      setOffers(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchOffers(); }, []);

  const filteredOffers = offers.filter(o => 
    o.card.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center mb-4 text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
          </Link>
          <h1 className="flex items-center gap-3 font-black text-3xl">
            Buylist Fortaleza <Store className="text-orange-500" />
          </h1>
          <p className="mt-2 text-slate-500">Veja quem está comprando suas cartas e quanto estão pagando agora.</p>
        </header>

        <div className="relative mb-8">
          <Search className="top-3.5 left-4 absolute w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Qual carta você quer repassar?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 shadow-lg py-3 pr-4 pl-12 border border-slate-800 focus:border-orange-500 rounded-xl outline-none w-full text-white transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="border-orange-500 border-t-2 rounded-full w-10 h-10 animate-spin"></div></div>
        ) : (
          <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredOffers.map((offer) => {
              const marketPrice = offer.card.price_history?.[0]?.price_avg || 0;
              const storePrice = marketPrice * (offer.buy_percentage / 100);

              return (
                <div key={offer.id} className="group bg-slate-900 p-4 border border-slate-800 hover:border-orange-500/30 rounded-2xl transition-all">
                  <div className="flex gap-4 mb-4">
                    <img src={offer.card.image_url} className="shadow-md rounded-lg w-20 h-28 object-cover" alt="" />
                    <div className="flex-1">
                      <p className="font-mono text-[10px] text-slate-500 uppercase">{offer.card.card_number}</p>
                      <h3 className="mb-1 font-bold text-slate-200 leading-tight">{offer.card.name}</h3>
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <TrendingDown className="w-3 h-3 text-red-400" />
                        Mkt: R$ {marketPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 mb-4 p-3 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">{offer.store?.name || 'Loja Parceira'}</p>
                        <p className="font-black text-emerald-400 text-2xl">R$ {storePrice.toFixed(2)}</p>
                      </div>
                      <span className="bg-emerald-500/10 px-2 py-1 rounded font-bold text-[10px] text-emerald-500">
                        {Number(offer.buy_percentage)}% em {offer.payment_method}
                      </span>
                    </div>
                  </div>

                  <a 
                    href={`https://wa.me/${offer.store?.whatsapp}?text=Olá, vi no BountyTracker que vocês estão comprando a carta ${offer.card.name}. Ainda está valendo?`}
                    target="_blank"
                    className="flex justify-center items-center gap-2 bg-slate-800 hover:bg-emerald-600 py-2 rounded-lg w-full font-bold text-white text-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chamar no WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {filteredOffers.length === 0 && !isLoading && (
          <div className="space-y-4 py-20 text-center">
            <AlertTriangle className="mx-auto w-12 h-12 text-slate-700" />
            <p className="text-slate-500">Nenhuma oferta de compra ativa no momento.</p>
            <p className="mx-auto max-w-xs text-slate-600 text-xs">
                Certifique-se de ter cadastrado ofertas na tabela <code className="bg-slate-900 px-0.5 px-1">store_buylists</code> vinculando cartas às lojas.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}