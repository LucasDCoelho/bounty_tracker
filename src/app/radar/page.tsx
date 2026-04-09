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
  store?: { name: string; whatsapp: string; address: string } | null;
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
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <Link href="/" className="inline-flex items-center mb-4 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
          </Link>
          <h1 className="flex items-center gap-3 font-black text-4xl">
            Radar de Torneios <Calendar className="text-primary" />
          </h1>
          <p className="mt-2 text-muted-foreground">Os próximos confrontos em Fortaleza. Prepare seu deck.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="border-primary border-t-2 rounded-full w-10 h-10 animate-spin"></div></div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => {
              const date = new Date(event.event_date);
              const dateFormatted = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
              const timeFormatted = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={event.id} className="group bg-surface shadow-black/10 shadow-xl border border-border hover:border-primary/40 rounded-3xl overflow-hidden transition-all">
                  <div className="md:flex">
                    {/* Data Badge */}
                    <div className="flex flex-col justify-center items-center bg-primary p-4 md:w-32 text-primary-foreground">
                      <span className="font-bold text-sm uppercase">{date.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                      <span className="font-black text-4xl">{date.getDate()}</span>
                      <span className="opacity-80 text-xs">{timeFormatted}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="bg-background px-2 py-1 border border-border rounded font-bold text-[10px] text-muted-foreground uppercase tracking-tighter">
                          {event.format}
                        </span>
                        <span className="bg-success/10 px-2 py-1 border border-success/20 rounded font-bold text-[10px] text-success uppercase">
                          Inscrições Abertas
                        </span>
                      </div>

                      <h2 className="mb-2 font-bold text-foreground text-2xl">{event.name}</h2>
                      <p className="mb-4 text-muted-foreground text-sm line-clamp-2">{event.description}</p>

                      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2 text-muted-foreground text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span className="truncate">{event.store?.name || 'Loja não informada'}{event.store?.address ? ` - ${event.store.address}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-primary" />
                          <span>Entrada: R$ {Number(event.entry_fee).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex justify-center items-center bg-background/50 p-6 border-border border-t md:border-t-0 md:border-l">
                      <a 
                        href={event.store?.whatsapp ? `https://wa.me/${event.store.whatsapp}?text=Olá! Gostaria de me inscrever no torneio ${event.name} do dia ${dateFormatted}.` : '#'}
                        target="_blank"
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-center transition-all ${event.store?.whatsapp ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed pointer-events-none'}`}
                      >
                        <MessageCircle className="w-5 h-5" />
                        {event.store?.whatsapp ? 'Garantir Vaga' : 'Contato indisponível'}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}

            {events.length === 0 && (
              <div className="bg-surface/50 py-20 border border-border border-dashed rounded-3xl text-center">
                <Clock className="mx-auto mb-4 w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum torneio agendado para os próximos dias.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}