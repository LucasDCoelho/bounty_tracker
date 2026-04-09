"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/hooks/use-auth-session';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ArrowLeft, Building2, CalendarPlus, Loader2, Search, Store, Tag, ToggleLeft, ToggleRight } from 'lucide-react';

type StoreData = {
  id: string;
  name: string;
  slug: string;
  city: string;
  whatsapp: string;
  instagram: string;
  logo_url?: string | null;
};

type GameData = {
  id: string;
  name: string;
  slug: string;
};

type TournamentData = {
  id: string;
  name: string;
  game_id?: string | null;
  event_date: string;
  entry_fee: number;
  format: string;
  is_active: boolean;
};

type BuylistItem = {
  id: string;
  buy_percentage: number;
  payment_method: string;
  is_active: boolean;
  card?: {
    name: string;
    card_number: string;
    image_url: string;
  } | null;
};

type CardOption = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
};

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function isRlsError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42501' || (error.message || '').toLowerCase().includes('row-level security');
}

export default function LojistaPage() {
  const router = useRouter();
  const { session, loading: loadingSession } = useAuthSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [store, setStore] = useState<StoreData | null>(null);
  const [games, setGames] = useState<GameData[]>([]);
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [buylist, setBuylist] = useState<BuylistItem[]>([]);

  const [storeForm, setStoreForm] = useState({
    name: '',
    city: 'Fortaleza',
    whatsapp: '',
    instagram: '',
    logoUrl: '',
  });

  const [storeSettingsForm, setStoreSettingsForm] = useState({
    name: '',
    city: 'Fortaleza',
    whatsapp: '',
    instagram: '',
    logoUrl: '',
  });

  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    eventDate: '',
    format: 'Standard',
    entryFee: '0',
    gameId: '',
  });

  const [cardQuery, setCardQuery] = useState('');
  const [cardOptions, setCardOptions] = useState<CardOption[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardOption | null>(null);
  const [buylistForm, setBuylistForm] = useState({
    buyPercentage: '50',
    paymentMethod: 'Crédito',
    gameId: '',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'tournament' | 'buylist' | null;
    item: TournamentData | BuylistItem | null;
  }>({
    isOpen: false,
    type: null,
    item: null,
  });
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const gameNameById = useMemo(() => {
    return new Map(games.map((game) => [game.id, game.name]));
  }, [games]);

  const canCreateBuylist = useMemo(() => {
    return Boolean(selectedCard) && Number(buylistForm.buyPercentage) > 0;
  }, [selectedCard, buylistForm.buyPercentage]);

  const kpis = useMemo(() => {
    const totalEvents = tournaments.length;
    const activeEvents = tournaments.filter((item) => item.is_active).length;
    const activeBuylist = buylist.filter((item) => item.is_active).length;
    const avgBuyPct = buylist.length
      ? buylist.reduce((acc, item) => acc + Number(item.buy_percentage || 0), 0) / buylist.length
      : 0;

    return {
      totalEvents,
      activeEvents,
      activeBuylist,
      avgBuyPct,
    };
  }, [tournaments, buylist]);

  const loadStoreContext = async (ownerId: string) => {
    setLoading(true);
    setError('');

    const { data: storesData, error: storeError } = await supabase
      .from('stores')
      .select('id, name, slug, city, whatsapp, instagram, logo_url')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (storeError) {
      setError(storeError.message);
      setLoading(false);
      return;
    }

    const existingStore = storesData?.[0] || null;
    setStore(existingStore);

    if (existingStore) {
      setStoreSettingsForm({
        name: existingStore.name || '',
        city: existingStore.city || 'Fortaleza',
        whatsapp: existingStore.whatsapp || '',
        instagram: existingStore.instagram || '',
        logoUrl: existingStore.logo_url || '',
      });

      await Promise.all([
        loadTournaments(existingStore.id),
        loadBuylist(existingStore.id),
      ]);
    }

    setLoading(false);
  };

  const loadGames = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (!error) {
      setGames((data as GameData[]) || []);
    }
  };

  const loadTournaments = async (storeId: string) => {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name, event_date, entry_fee, format, is_active')
      .eq('store_id', storeId)
      .order('event_date', { ascending: true });

    if (!error) setTournaments((data as TournamentData[]) || []);
  };

  const loadBuylist = async (storeId: string) => {
    const { data, error } = await supabase
      .from('store_buylists')
      .select('id, buy_percentage, payment_method, is_active, card:cards(name, card_number, image_url)')
      .eq('store_id', storeId)
      .order('updated_at', { ascending: false });

    if (!error) {
      const normalized = (data || []).map((item: any) => {
        const cardValue = Array.isArray(item.card) ? item.card[0] : item.card;
        return {
          ...item,
          card: cardValue || null,
        };
      });
      setBuylist(normalized as BuylistItem[]);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    if (loadingSession) return;

    if (!session) {
      router.replace('/login');
      return;
    }

    loadStoreContext(session.user.id);
  }, [loadingSession, router, session]);

  const createStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    if (store) {
      setError('Esta conta ja possui uma loja vinculada. Use o formulario de edicao.');
      setSaving(false);
      return;
    }

    if (!session) {
      router.replace('/login');
      setSaving(false);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError('Sua sessao expirou. Faca login novamente para criar a loja.');
      setSaving(false);
      router.replace('/login');
      return;
    }

    const { count, error: countError } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', session.user.id);

    if (countError) {
      setError(countError.message);
      setSaving(false);
      return;
    }

    if ((count || 0) > 0) {
      setError('Esta conta ja possui uma loja cadastrada.');
      setSaving(false);
      await loadStoreContext(session.user.id);
      return;
    }

    const slug = slugify(storeForm.name);
    if (!slug) {
      setError('Informe um nome valido para gerar o slug da loja.');
      setSaving(false);
      return;
    }

    const payload = {
      owner_id: session.user.id,
      name: storeForm.name.trim(),
      slug,
      city: storeForm.city.trim() || 'Fortaleza',
      whatsapp: storeForm.whatsapp.trim(),
      instagram: storeForm.instagram.trim(),
      logo_url: storeForm.logoUrl.trim(),
    };

    const { error: insertError } = await supabase.from('stores').insert([payload]);

    if (insertError) {
      const isRlsError =
        insertError.code === '42501' ||
        insertError.message.toLowerCase().includes('row-level security');

      if (isRlsError) {
        setError('Permissao negada no banco (RLS) ao criar loja. Aplique as politicas de stores para owner_id = auth.uid(). Arquivo: supabase/rls/stores.sql');
      } else {
        setError(insertError.message);
      }
      setSaving(false);
      return;
    }

    setMessage('Loja cadastrada com sucesso.');
    setSaving(false);
    await loadStoreContext(session.user.id);
  };

  const updateStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;

    setSaving(true);
    setError('');
    setMessage('');

    const nextName = storeSettingsForm.name.trim();
    const nextSlug = slugify(nextName);

    if (!nextSlug) {
      setError('Informe um nome valido para sua loja.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('stores')
      .update({
        name: nextName,
        slug: nextSlug,
        city: storeSettingsForm.city.trim() || 'Fortaleza',
        whatsapp: storeSettingsForm.whatsapp.trim(),
        instagram: storeSettingsForm.instagram.trim(),
        logo_url: storeSettingsForm.logoUrl.trim(),
      })
      .eq('id', store.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage('Dados da loja atualizados.');
    setSaving(false);
    if (session) {
      await loadStoreContext(session.user.id);
    }
  };

  const createTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;

    setSaving(true);
    setError('');
    setMessage('');

    const { error: insertError } = await supabase.from('tournaments').insert([
      {
        store_id: store.id,
        name: tournamentForm.name.trim(),
        event_date: tournamentForm.eventDate,
        format: tournamentForm.format.trim() || 'Standard',
        entry_fee: Number(tournamentForm.entryFee || '0'),
        game_id: tournamentForm.gameId || null,
        is_active: true,
      },
    ]);

    if (insertError) {
      if (isRlsError(insertError)) {
        setError('Permissao negada no banco (RLS) ao publicar evento. Aplique as politicas para tournaments no arquivo supabase/rls/stores.sql.');
      } else {
        setError(insertError.message);
      }
      setSaving(false);
      return;
    }

    setTournamentForm({
      name: '',
      eventDate: '',
      format: 'Standard',
      entryFee: '0',
      gameId: '',
    });
    setMessage('Evento criado.');
    setSaving(false);
    await loadTournaments(store.id);
  };

  const searchCards = async (query: string) => {
    if (!query.trim()) {
      setCardOptions([]);
      return;
    }

    let setIds: string[] = [];
    if (buylistForm.gameId) {
      const { data: setsData } = await supabase
        .from('sets')
        .select('id')
        .eq('game_id', buylistForm.gameId);

      setIds = (setsData || []).map((item: any) => item.id).filter(Boolean);
      if (!setIds.length) {
        setCardOptions([]);
        return;
      }
    }

    let queryBuilder = supabase
      .from('cards')
      .select('id, name, card_number, image_url, set_id')
      .ilike('name', `%${query}%`)
      .limit(8);

    if (setIds.length) {
      queryBuilder = queryBuilder.in('set_id', setIds);
    }

    const { data } = await queryBuilder;

    setCardOptions((data as CardOption[]) || []);
  };

  const createBuylistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !selectedCard) return;

    setSaving(true);
    setError('');
    setMessage('');

    const { error: insertError } = await supabase.from('store_buylists').insert([
      {
        store_id: store.id,
        card_id: selectedCard.id,
        buy_percentage: Number(buylistForm.buyPercentage),
        payment_method: buylistForm.paymentMethod,
        is_active: true,
      },
    ]);

    if (insertError) {
      if (isRlsError(insertError)) {
        setError('Permissao negada no banco (RLS) ao salvar oferta. Aplique as politicas para store_buylists no arquivo supabase/rls/stores.sql.');
      } else {
        setError(insertError.message);
      }
      setSaving(false);
      return;
    }

    setSelectedCard(null);
    setCardQuery('');
    setCardOptions([]);
    setBuylistForm({ buyPercentage: '50', paymentMethod: 'Crédito', gameId: buylistForm.gameId });
    setMessage('Oferta adicionada na buylist.');
    setSaving(false);
    await loadBuylist(store.id);
  };

  const toggleTournament = async (item: TournamentData) => {
    if (item.is_active) {
      setConfirmDialog({ isOpen: true, type: 'tournament', item });
      return;
    }
    // Direct activation if no confirm needed
    await performTournamentToggle(item);
  };

  const performTournamentToggle = async (item: TournamentData) => {
    setIsConfirmLoading(true);
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    setIsConfirmLoading(false);
    setConfirmDialog({ isOpen: false, type: null, item: null });
    if (updateError) {
      if (isRlsError(updateError)) {
        setError('Permissao negada no banco (RLS) ao alterar status do evento. Revise as politicas de tournaments.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    if (store) loadTournaments(store.id);
  };

  const toggleBuylist = async (item: BuylistItem) => {
    if (item.is_active) {
      setConfirmDialog({ isOpen: true, type: 'buylist', item });
      return;
    }
    // Direct activation if no confirm needed
    await performBuylistToggle(item);
  };

  const performBuylistToggle = async (item: BuylistItem) => {
    setIsConfirmLoading(true);
    const { error: updateError } = await supabase
      .from('store_buylists')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    setIsConfirmLoading(false);
    setConfirmDialog({ isOpen: false, type: null, item: null });
    if (updateError) {
      if (isRlsError(updateError)) {
        setError('Permissao negada no banco (RLS) ao alterar status da oferta. Revise as politicas de store_buylists.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    if (store) loadBuylist(store.id);
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center bg-background min-h-screen text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          Carregando painel lojista...
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 mb-8">
          <Link href="/perfil" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar ao Perfil
          </Link>
          <h1 className="flex items-center gap-2 font-black text-2xl">
            Painel do Lojista <Store className="w-6 h-6 text-primary" />
          </h1>
        </header>

        {error && <p className="bg-danger/10 mb-4 px-4 py-2 border border-danger/30 rounded-lg text-danger text-sm">{error}</p>}
        {message && <p className="bg-success/10 mb-4 px-4 py-2 border border-success/30 rounded-lg text-success text-sm">{message}</p>}

        {!store ? (
          <section className="bg-surface shadow-black/10 shadow-xl p-5 md:p-6 border border-border rounded-2xl">
            <h2 className="flex items-center gap-2 mb-4 font-bold text-xl">
              <Building2 className="w-5 h-5 text-primary" />
              Cadastrar Minha Loja
            </h2>
            <p className="mb-6 text-muted-foreground text-sm">
              Este fluxo e separado do usuario comum. Use uma conta de lojista para gerir eventos e buylist.
            </p>

            <form onSubmit={createStore} className="gap-4 grid grid-cols-1 md:grid-cols-2">
              <input
                type="text"
                required
                value={storeForm.name}
                onChange={(e) => setStoreForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome da loja"
                className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
              />
              <input
                type="text"
                value={storeForm.city}
                onChange={(e) => setStoreForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="Cidade"
                className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
              />
              <input
                type="text"
                value={storeForm.whatsapp}
                onChange={(e) => setStoreForm((p) => ({ ...p, whatsapp: e.target.value }))}
                placeholder="WhatsApp (somente numeros)"
                className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
              />
              <input
                type="text"
                value={storeForm.instagram}
                onChange={(e) => setStoreForm((p) => ({ ...p, instagram: e.target.value }))}
                placeholder="Instagram"
                className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
              />
              <button
                type="submit"
                disabled={saving}
                className="md:col-span-2 bg-primary hover:bg-primary/90 disabled:opacity-60 px-4 py-3 rounded-lg font-bold text-primary-foreground transition-colors"
              >
                {saving ? 'Criando loja...' : 'Criar Loja'}
              </button>
            </form>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="gap-3 grid grid-cols-2 lg:grid-cols-4">
              <div className="bg-surface p-4 border border-border rounded-xl">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Eventos</p>
                <p className="font-black text-info text-2xl">{kpis.totalEvents}</p>
              </div>
              <div className="bg-surface p-4 border border-border rounded-xl">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Ativos</p>
                <p className="font-black text-success text-2xl">{kpis.activeEvents}</p>
              </div>
              <div className="bg-surface p-4 border border-border rounded-xl">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Buylist Ativa</p>
                <p className="font-black text-primary text-2xl">{kpis.activeBuylist}</p>
              </div>
              <div className="bg-surface p-4 border border-border rounded-xl">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Media % Compra</p>
                <p className="font-black text-secondary text-2xl">{kpis.avgBuyPct.toFixed(1)}%</p>
              </div>
            </section>

            <section className="bg-surface shadow-black/10 shadow-xl p-5 border border-border rounded-2xl">
              <div className="flex items-center gap-4">
                <img
                  src={store.logo_url || 'https://via.placeholder.com/80x80?text=Loja'}
                  alt={store.name}
                  className="rounded-xl w-14 h-14 object-cover"
                />
                <div>
                  <p className="font-black text-foreground text-lg">{store.name}</p>
                  <p className="text-muted-foreground text-sm">@{store.slug} • {store.city}</p>
                  <p className="text-muted-foreground text-xs">WhatsApp: {store.whatsapp || 'Nao informado'}</p>
                </div>
              </div>
            </section>

            <section className="bg-surface shadow-black/10 shadow-xl p-5 border border-border rounded-2xl">
              <h3 className="mb-4 font-bold text-lg">Editar Loja</h3>
              <form onSubmit={updateStoreSettings} className="gap-4 grid grid-cols-1 md:grid-cols-2">
                <input
                  type="text"
                  required
                  value={storeSettingsForm.name}
                  onChange={(e) => setStoreSettingsForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome da loja"
                  className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
                />
                <input
                  type="text"
                  value={storeSettingsForm.city}
                  onChange={(e) => setStoreSettingsForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Cidade"
                  className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
                />
                <input
                  type="text"
                  value={storeSettingsForm.whatsapp}
                  onChange={(e) => setStoreSettingsForm((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="WhatsApp"
                  className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
                />
                <input
                  type="text"
                  value={storeSettingsForm.instagram}
                  onChange={(e) => setStoreSettingsForm((p) => ({ ...p, instagram: e.target.value }))}
                  placeholder="Instagram"
                  className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
                />
                <input
                  type="url"
                  value={storeSettingsForm.logoUrl}
                  onChange={(e) => setStoreSettingsForm((p) => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="URL da logo"
                  className="md:col-span-2 bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none text-foreground"
                />
                {storeSettingsForm.logoUrl && (
                  <div className="flex items-center gap-3 md:col-span-2 bg-background p-3 border border-border rounded-lg">
                    <img src={storeSettingsForm.logoUrl} alt="Preview logo" className="rounded w-12 h-12 object-cover" />
                    <p className="text-muted-foreground text-xs">Preview da logo da loja</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="md:col-span-2 bg-primary hover:bg-primary/90 disabled:opacity-60 py-3 rounded-lg font-bold text-primary-foreground transition-colors"
                >
                  Salvar Dados da Loja
                </button>
              </form>
            </section>

            <section className="gap-6 grid grid-cols-1 lg:grid-cols-2">
              <div className="bg-surface shadow-black/10 shadow-xl p-5 border border-border rounded-2xl">
                <h3 className="flex items-center gap-2 mb-4 font-bold text-lg">
                  <CalendarPlus className="w-5 h-5 text-info" /> Criar Evento
                </h3>

                <form onSubmit={createTournament} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={tournamentForm.name}
                    onChange={(e) => setTournamentForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nome do evento"
                    className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                  />
                  <input
                    type="datetime-local"
                    required
                    value={tournamentForm.eventDate}
                    onChange={(e) => setTournamentForm((p) => ({ ...p, eventDate: e.target.value }))}
                    className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                  />
                  <div className="gap-3 grid grid-cols-2">
                    <select
                      value={tournamentForm.gameId}
                      onChange={(e) => setTournamentForm((p) => ({ ...p, gameId: e.target.value }))}
                      className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                    >
                      <option value="">Jogo (opcional)</option>
                      {games.map((game) => (
                        <option key={game.id} value={game.id}>{game.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={tournamentForm.format}
                      onChange={(e) => setTournamentForm((p) => ({ ...p, format: e.target.value }))}
                      placeholder="Formato"
                      className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                    />
                  </div>
                  <div className="gap-3 grid grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tournamentForm.entryFee}
                      onChange={(e) => setTournamentForm((p) => ({ ...p, entryFee: e.target.value }))}
                      placeholder="Entrada"
                      className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-info hover:bg-info/90 disabled:opacity-60 py-3 rounded-lg w-full font-bold text-info-foreground transition-colors"
                  >
                    Publicar Evento
                  </button>
                </form>

                <div className="space-y-2 mt-5">
                  {tournaments.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-background p-3 border border-border rounded-lg">
                      <div>
                        <p className="font-bold text-sm">{item.name}</p>
                        <p className="text-muted-foreground text-xs">{new Date(item.event_date).toLocaleString('pt-BR')} • {item.format} • {item.game_id ? (gameNameById.get(item.game_id) || 'Jogo') : 'Sem jogo'}</p>
                      </div>
                      <button onClick={() => toggleTournament(item)} className="text-muted-foreground hover:text-foreground text-xs">
                        {item.is_active ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface shadow-black/10 shadow-xl p-5 border border-border rounded-2xl">
                <h3 className="flex items-center gap-2 mb-4 font-bold text-lg">
                  <Tag className="w-5 h-5 text-success" /> Gerir Buylist
                </h3>

                <form onSubmit={createBuylistItem} className="space-y-3">
                  <select
                    value={buylistForm.gameId}
                    onChange={(e) => {
                      setBuylistForm((p) => ({ ...p, gameId: e.target.value }));
                      setSelectedCard(null);
                      setCardQuery('');
                      setCardOptions([]);
                    }}
                    className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                  >
                    <option value="">Filtrar cartas por jogo (opcional)</option>
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>{game.name}</option>
                    ))}
                  </select>

                  <div className="relative">
                    <Search className="top-3 left-3 absolute w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={cardQuery}
                      onChange={(e) => {
                        setCardQuery(e.target.value);
                        searchCards(e.target.value);
                      }}
                      placeholder="Buscar carta para buylist"
                      className="bg-background py-3 pr-4 pl-9 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                    />
                  </div>

                  {cardOptions.length > 0 && (
                    <div className="space-y-2 bg-background p-2 border border-border rounded-lg max-h-52 overflow-y-auto">
                      {cardOptions.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            setSelectedCard(card);
                            setCardQuery(`${card.card_number} - ${card.name}`);
                            setCardOptions([]);
                          }}
                          className="flex items-center gap-2 hover:bg-accent p-2 rounded w-full text-left"
                        >
                          <img src={card.image_url} alt={card.name} className="rounded w-8 h-11 object-cover" />
                          <div>
                            <p className="font-bold text-sm">{card.name}</p>
                            <p className="text-muted-foreground text-xs">{card.card_number}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="gap-3 grid grid-cols-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={buylistForm.buyPercentage}
                      onChange={(e) => setBuylistForm((p) => ({ ...p, buyPercentage: e.target.value }))}
                      placeholder="% pago"
                      className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                    />
                    <input
                      type="text"
                      value={buylistForm.paymentMethod}
                      onChange={(e) => setBuylistForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                      placeholder="Metodo"
                      className="bg-background px-4 py-3 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!canCreateBuylist || saving}
                    className="bg-success hover:bg-success/90 disabled:opacity-60 py-3 rounded-lg w-full font-bold text-success-foreground transition-colors"
                  >
                    Salvar Oferta
                  </button>
                </form>

                <div className="space-y-2 mt-5">
                  {buylist.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-background p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={item.card?.image_url || 'https://via.placeholder.com/32x44?text=C'} alt="" className="rounded w-8 h-11 object-cover" />
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{item.card?.name || 'Carta indisponivel'}</p>
                          <p className="text-muted-foreground text-xs">{item.buy_percentage}% em {item.payment_method}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleBuylist(item)} className="text-muted-foreground hover:text-foreground text-xs">
                        {item.is_active ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.type === 'tournament' ? 'Desativar Evento' : 'Desativar Oferta da Buylist'}
        description={
          confirmDialog.type === 'tournament'
            ? 'Este evento será desativado e não aparecerá no radar de lojistas. Você pode ativá-lo novamente depois.'
            : 'Esta oferta será removida da buylist. Você pode reativá-la depois.'
        }
        confirmText="Desativar"
        cancelText="Manter Ativa"
        isDangerous={true}
        isLoading={isConfirmLoading}
        onConfirm={async () => {
          if (confirmDialog.type === 'tournament' && confirmDialog.item) {
            await performTournamentToggle(confirmDialog.item as TournamentData);
          } else if (confirmDialog.type === 'buylist' && confirmDialog.item) {
            await performBuylistToggle(confirmDialog.item as BuylistItem);
          }
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, type: null, item: null })}
      />
    </main>
  );
}
