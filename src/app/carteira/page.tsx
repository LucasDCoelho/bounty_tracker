"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Importação necessária
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Wallet, TrendingUp, Landmark, Store, Loader2 } from 'lucide-react';

type CollectionItem = {
  id: string;
  quantity: number;
  card: {
    name: string;
    image_url: string;
    price_history: { price_avg: number }[];
  };
};

export default function Portfolio() {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCollection = async () => {
    setIsLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log("Nenhuma sessão encontrada");
      router.push('/login');
      return;
    }

    console.log("ID do Usuário Logado:", session.user.id);

    const { data, error } = await supabase
      .from('user_collections')
      .select(`
        id,
        quantity,
        card:cards (
          name,
          image_url,
          price_history ( price_avg, created_at )
        )
      `)
      .eq('user_id', session.user.id);

    if (error) {
      console.error("Erro na busca do Supabase:", error);
    }

    if (data) {
      console.log("Dados brutos recebidos:", data);

      // Filtramos apenas itens que possuem o objeto 'card' (evita crash se o RLS bloquear o join)
      const formattedData = data
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
      
      setCollection(formattedData);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCollection();
  }, []);

  // Lógica Financeira (Mantida)
  const totalMarket = collection.reduce((acc, item) => {
    const price = item.card.price_history?.[0]?.price_avg || 0;
    return acc + (price * item.quantity);
  }, 0);

  const totalCommunity = totalMarket * 0.8;
  const totalStore = totalMarket * 0.5;

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center bg-background min-h-screen text-muted-foreground">
        <Loader2 className="mb-4 w-10 h-10 text-primary animate-spin" />
        <p>Sincronizando seus ativos...</p>
      </div>
    );
  }

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar ao Mercado
          </Link>
          <h1 className="flex items-center gap-2 font-bold text-2xl">
            Minha Carteira <Wallet className="text-primary" />
          </h1>
        </header>

        {/* Dashboards de Patrimônio */}
        <div className="gap-6 grid grid-cols-1 md:grid-cols-3 mb-10">
          <div className="bg-surface shadow-xl p-6 border border-border rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground">
              <TrendingUp className="w-5 h-5 text-success" />
              <span className="font-bold text-xs uppercase tracking-widest">Patrimônio Bruto</span>
            </div>
            <p className="font-black text-foreground text-3xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMarket)}
            </p>
          </div>

          <div className="bg-surface shadow-xl p-6 border border-primary/20 rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-primary">
              <Landmark className="w-5 h-5" />
              <span className="font-bold text-xs uppercase tracking-widest">Valor de Troca (-20%)</span>
            </div>
            <p className="font-black text-primary text-3xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommunity)}
            </p>
          </div>

          <div className="bg-surface shadow-xl p-6 border border-border rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground">
              <Store className="w-5 h-5 text-secondary" />
              <span className="font-bold text-xs uppercase tracking-widest">Repasse Lojista (-50%)</span>
            </div>
            <p className="font-black text-muted-foreground text-3xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalStore)}
            </p>
          </div>
        </div>

        {/* Tabela de Ativos */}
        <div className="bg-surface shadow-2xl border border-border rounded-2xl overflow-hidden">
          {collection.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-left border-collapse">
              <thead className="bg-background font-bold text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Carta</th>
                  <th className="p-4">Qtd</th>
                  <th className="p-4">Preço Médio</th>
                  <th className="p-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collection.map((item) => {
                  const price = item.card.price_history?.[0]?.price_avg || 0;
                  return (
                    <tr key={item.id} className="group hover:bg-accent transition-colors">
                      <td className="flex items-center gap-3 p-4">
                        <img src={item.card.image_url} className="shadow-lg rounded w-10 h-14 object-cover group-hover:scale-110 transition-transform" alt="" />
                        <span className="font-bold text-foreground text-sm">{item.card.name}</span>
                      </td>
                      <td className="p-4 font-mono text-muted-foreground">{item.quantity}</td>
                      <td className="p-4 text-muted-foreground text-sm">R$ {price.toFixed(2)}</td>
                      <td className="p-4 font-black text-success text-right">
                        R$ {(price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="space-y-4 p-20 text-center">
              <div className="flex justify-center items-center bg-muted mx-auto rounded-full w-16 h-16 text-muted-foreground">
                <Wallet className="w-8 h-8" />
              </div>
              <p className="text-muted-foreground">Sua carteira está vazia por enquanto.</p>
              <Link href="/" className="inline-block bg-primary hover:bg-primary/90 px-6 py-2 rounded-lg font-bold text-primary-foreground transition-all">
                Explorar Mercado
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}