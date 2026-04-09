"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Bell, BellOff, TrendingDown, Trash2, Plus, Loader2 } from 'lucide-react';

type Alert = {
  id: string;
  target_price: number;
  card?: {
    name: string;
    image_url: string;
    price_history: { price_avg: number }[];
  } | null;
};

export default function PriceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from('user_alerts')
        .select(`
          id, target_price,
          card:cards (
            name, image_url,
            price_history ( price_avg, created_at )
          )
        `)
        .eq('user_id', user.id);

      if (data) {
        // Ordena preços para pegar o mais atual
        const formatted = data
          .filter((item: any) => item.card !== null)
          .map((item: any) => ({
          ...item,
          card: {
            ...item.card,
            price_history: (item.card.price_history || []).sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          }
          }));
        setAlerts(formatted);
      }
    }
    setIsLoading(false);
  };

  const deleteAlert = async (id: string) => {
    const { error } = await supabase.from('user_alerts').delete().eq('id', id);
    if (!error) setAlerts(alerts.filter(a => a.id !== id));
  };

  useEffect(() => { fetchAlerts(); }, []);

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-4xl">
        <header className="flex justify-between items-center mb-10">
          <div>
            <Link href="/" className="inline-flex items-center mb-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
            </Link>
            <h1 className="flex items-center gap-3 font-black text-3xl">
              Quadro de Bounties <Bell className="text-primary" />
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">Sua lista de caça: avisaremos quando o preço cair.</p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="text-primary animate-spin" /></div>
        ) : (
          <div className="gap-4 grid">
            {alerts.map((alert) => {
              const card = alert.card;
              if (!card) return null;

              const currentPrice = card.price_history?.[0]?.price_avg || 0;
              const diff = currentPrice - alert.target_price;

              return (
                <div key={alert.id} className="group flex items-center gap-4 bg-surface p-4 border border-border rounded-2xl">
                  <img src={card.image_url} className="shadow-lg rounded-lg w-16 h-22 object-cover" alt="" />
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-lg">{card.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="text-muted-foreground text-xs">
                        Alvo: <span className="font-bold text-primary">R$ {alert.target_price.toFixed(2)}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Atual: <span className="font-bold text-foreground">R$ {currentPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block text-right">
                    <p className="font-bold text-[10px] text-muted-foreground uppercase">Distância</p>
                    <p className={`font-mono font-bold ${diff > 0 ? 'text-muted-foreground' : 'text-success'}`}>
                      {diff > 0 ? `+ R$ ${diff.toFixed(2)}` : 'ALVO ATINGIDO!'}
                    </p>
                  </div>

                  <button 
                    onClick={() => deleteAlert(alert.id)}
                    className="hover:bg-danger/10 p-3 rounded-xl text-muted-foreground hover:text-danger transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}

            {alerts.length === 0 && (
              <div className="bg-surface/50 py-20 border border-border border-dashed rounded-3xl text-center">
                <BellOff className="mx-auto mb-4 w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum "Bounty" ativo. Adicione alertas nas páginas das cartas!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}