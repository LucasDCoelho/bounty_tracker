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
      <div className="flex flex-col justify-center items-center bg-slate-950 min-h-screen text-slate-400">
        <Loader2 className="mb-4 w-10 h-10 text-orange-500 animate-spin" />
        <p>Sincronizando seus ativos...</p>
      </div>
    );
  }

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar ao Mercado
          </Link>
          <h1 className="flex items-center gap-2 font-bold text-2xl">
            Minha Carteira <Wallet className="text-orange-500" />
          </h1>
        </header>

        {/* Dashboards de Patrimônio */}
        <div className="gap-6 grid grid-cols-1 md:grid-cols-3 mb-10">
          <div className="bg-slate-900 shadow-xl p-6 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-slate-400">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-xs uppercase tracking-widest">Patrimônio Bruto</span>
            </div>
            <p className="font-black text-white text-3xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMarket)}
            </p>
          </div>

          <div className="bg-slate-900 shadow-xl p-6 border border-orange-500/20 rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-orange-400">
              <Landmark className="w-5 h-5" />
              <span className="font-bold text-xs uppercase tracking-widest">Valor de Troca (-20%)</span>
            </div>
            <p className="font-black text-orange-500 text-3xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommunity)}
            </p>
          </div>

          <div className="bg-slate-900 shadow-xl p-6 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-slate-400">
              <Store className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-xs uppercase tracking-widest">Repasse Lojista (-50%)</span>
            </div>
            <p className="font-black text-slate-300 text-3xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalStore)}
            </p>
          </div>
        </div>

        {/* Tabela de Ativos */}
        <div className="bg-slate-900 shadow-2xl border border-slate-800 rounded-2xl overflow-hidden">
          {collection.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-left border-collapse">
              <thead className="bg-slate-950 font-bold text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Carta</th>
                  <th className="p-4">Qtd</th>
                  <th className="p-4">Preço Médio</th>
                  <th className="p-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {collection.map((item) => {
                  const price = item.card.price_history?.[0]?.price_avg || 0;
                  return (
                    <tr key={item.id} className="group hover:bg-slate-800/40 transition-colors">
                      <td className="flex items-center gap-3 p-4">
                        <img src={item.card.image_url} className="shadow-lg rounded w-10 h-14 object-cover group-hover:scale-110 transition-transform" alt="" />
                        <span className="font-bold text-slate-200 text-sm">{item.card.name}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-300">{item.quantity}</td>
                      <td className="p-4 text-slate-400 text-sm">R$ {price.toFixed(2)}</td>
                      <td className="p-4 font-black text-emerald-400 text-right">
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
              <div className="flex justify-center items-center bg-slate-800 mx-auto rounded-full w-16 h-16 text-slate-500">
                <Wallet className="w-8 h-8" />
              </div>
              <p className="text-slate-500">Sua carteira está vazia por enquanto.</p>
              <Link href="/" className="inline-block bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-lg font-bold text-white transition-all">
                Explorar Mercado
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}