"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Store, Search, TrendingDown, MessageCircle, AlertTriangle } from 'lucide-react';

type BuylistOffer = {
  id: string;
  buy_percentage: number;
  payment_method: string;
  store?: { 
    name: string; 
    whatsapp: string; // Corrigido de contact para whatsapp
  } | null;
  card?: {
    name: string;
    card_number: string;
    image_url: string;
    price_history: { price_avg: number; created_at: string }[];
  } | null;
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
    (o.card?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center mb-4 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
          </Link>
          <h1 className="flex items-center gap-3 font-black text-3xl">
            Buylist Fortaleza <Store className="text-primary" />
          </h1>
          <p className="mt-2 text-muted-foreground">Veja quem está comprando suas cartas e quanto estão pagando agora.</p>
        </header>

        <div className="relative mb-8">
          <Search className="top-3.5 left-4 absolute w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Qual carta você quer repassar?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface shadow-lg py-3 pr-4 pl-12 border border-border focus:border-primary rounded-xl outline-none w-full text-foreground transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="border-primary border-t-2 rounded-full w-10 h-10 animate-spin"></div></div>
        ) : (
          <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredOffers.map((offer) => {
              const marketPrice = offer.card?.price_history?.[0]?.price_avg || 0;
              const storePrice = marketPrice * (offer.buy_percentage / 100);

              return (
                <div key={offer.id} className="group bg-surface p-4 border border-border hover:border-primary/30 rounded-2xl transition-all">
                  <div className="flex gap-4 mb-4">
                    <img src={offer.card?.image_url || 'https://via.placeholder.com/80x112?text=Carta'} className="shadow-md rounded-lg w-20 h-28 object-cover" alt="" />
                    <div className="flex-1">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase">{offer.card?.card_number || 'N/D'}</p>
                      <h3 className="mb-1 font-bold text-foreground leading-tight">{offer.card?.name || 'Carta indisponível'}</h3>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <TrendingDown className="w-3 h-3 text-danger" />
                        Mkt: R$ {marketPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-background mb-4 p-3 border border-border rounded-xl">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest">{offer.store?.name || 'Loja Parceira'}</p>
                        <p className="font-black text-success text-2xl">R$ {storePrice.toFixed(2)}</p>
                      </div>
                      <span className="bg-success/10 px-2 py-1 rounded font-bold text-[10px] text-success">
                        {Number(offer.buy_percentage)}% em {offer.payment_method}
                      </span>
                    </div>
                  </div>

                  <a 
                    href={offer.store?.whatsapp ? `https://wa.me/${offer.store.whatsapp}?text=Olá, vi no BountyTracker que vocês estão comprando a carta ${offer.card?.name || 'informada'}. Ainda está valendo?` : '#'}
                    target="_blank"
                    className={`flex justify-center items-center gap-2 py-2 rounded-lg w-full font-bold text-sm transition-all ${offer.store?.whatsapp ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed pointer-events-none'}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {offer.store?.whatsapp ? 'Chamar no WhatsApp' : 'WhatsApp indisponível'}
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {filteredOffers.length === 0 && !isLoading && (
          <div className="space-y-4 py-20 text-center">
            <AlertTriangle className="mx-auto w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma oferta de compra ativa no momento.</p>
            <p className="mx-auto max-w-xs text-muted-foreground text-xs">
                Certifique-se de ter cadastrado ofertas na tabela <code className="bg-surface px-1">store_buylists</code> vinculando cartas às lojas.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}