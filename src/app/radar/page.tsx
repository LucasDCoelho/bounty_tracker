"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, MapPin, Users, Ticket, MessageCircle, Clock } from 'lucide-react';

type Tournament = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  entry_fee: number;
  format: string;
  max_players: number;
  store: { name: string; whatsapp: string; address: string };
};

export default function TournamentRadar() {
  const [events, setEvents] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        store:stores ( name, whatsapp, address )
      `)
      .eq('is_active', true)
      .order('event_date', { ascending: true });

    if (!error && data) setEvents(data as any);
    setIsLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <Link href="/" className="inline-flex items-center mb-4 text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
          </Link>
          <h1 className="flex items-center gap-3 font-black text-4xl">
            Radar de Torneios <Calendar className="text-orange-500" />
          </h1>
          <p className="mt-2 text-slate-500">Os próximos confrontos em Fortaleza. Prepare seu deck.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="border-orange-500 border-t-2 rounded-full w-10 h-10 animate-spin"></div></div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => {
              const date = new Date(event.event_date);
              const dateFormatted = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
              const timeFormatted = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={event.id} className="group bg-slate-900 shadow-xl border border-slate-800 hover:border-orange-500/40 rounded-3xl overflow-hidden transition-all">
                  <div className="md:flex">
                    {/* Data Badge */}
                    <div className="flex flex-col justify-center items-center bg-orange-600 p-4 md:w-32 text-white">
                      <span className="font-bold text-sm uppercase">{date.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                      <span className="font-black text-4xl">{date.getDate()}</span>
                      <span className="opacity-80 text-xs">{timeFormatted}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="bg-slate-800 px-2 py-1 border border-slate-700 rounded font-bold text-[10px] text-slate-300 uppercase tracking-tighter">
                          {event.format}
                        </span>
                        <span className="bg-emerald-500/10 px-2 py-1 border border-emerald-500/20 rounded font-bold text-[10px] text-emerald-500 uppercase">
                          Inscrições Abertas
                        </span>
                      </div>

                      <h2 className="mb-2 font-bold text-white text-2xl">{event.name}</h2>
                      <p className="mb-4 text-slate-400 text-sm line-clamp-2">{event.description}</p>

                      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2 text-slate-500 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span className="truncate">{event.store.name} - {event.store.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-orange-500" />
                          <span>Entrada: R$ {Number(event.entry_fee).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex justify-center items-center bg-slate-950/50 p-6 border-slate-800 border-t md:border-t-0 md:border-l">
                      <a 
                        href={`https://wa.me/${event.store.whatsapp}?text=Olá! Gostaria de me inscrever no torneio ${event.name} do dia ${dateFormatted}.`}
                        target="_blank"
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-bold text-white whitespace-nowrap transition-all"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Garantir Vaga
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}

            {events.length === 0 && (
              <div className="bg-slate-900/50 py-20 border border-slate-800 border-dashed rounded-3xl text-center">
                <Clock className="mx-auto mb-4 w-12 h-12 text-slate-700" />
                <p className="text-slate-500">Nenhum torneio agendado para os próximos dias.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}