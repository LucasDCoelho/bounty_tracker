"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/hooks/use-auth-session';
import { ArrowLeft, UserCircle2, Save, LogOut, Loader2, Store } from 'lucide-react';

type ProfileForm = {
  email: string;
  displayName: string;
  avatarUrl: string;
  telegramChatId: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { session, loading: loadingSession } = useAuthSession();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<ProfileForm>({
    email: '',
    displayName: '',
    avatarUrl: '',
    telegramChatId: '',
  });

  useEffect(() => {
    if (loadingSession) return;

    if (!session) {
      router.replace('/login');
      return;
    }

    const metadata = session.user.user_metadata || {};
    setForm({
      email: session.user.email || '',
      displayName: metadata.display_name || metadata.name || '',
      avatarUrl: metadata.avatar_url || metadata.picture || metadata.photoURL || '',
      telegramChatId: metadata.telegram_chat_id || '',
    });
  }, [loadingSession, router, session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        display_name: form.displayName.trim(),
        avatar_url: form.avatarUrl.trim(),
        telegram_chat_id: form.telegramChatId.trim(),
      },
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage('Perfil atualizado com sucesso.');
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  if (loadingSession) {
    return (
      <main className="flex justify-center items-center bg-slate-950 min-h-screen text-slate-300">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          Carregando perfil...
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 mb-8">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Link>
          <h1 className="flex items-center gap-2 font-black text-2xl">
            Meu Perfil <UserCircle2 className="w-6 h-6 text-orange-500" />
          </h1>
        </header>

        <section className="bg-slate-900 shadow-xl p-5 md:p-6 border border-slate-800 rounded-2xl">
          <div className="bg-indigo-500/10 mb-6 p-4 border border-indigo-500/20 rounded-xl">
            <p className="font-bold text-indigo-300 text-sm uppercase tracking-wider">Fluxo Lojista</p>
            <p className="mt-1 text-slate-300 text-sm">Use uma conta de lojista para cadastrar loja, criar eventos e definir a buylist.</p>
            <Link href="/lojista" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 mt-3 px-3 py-2 rounded-lg font-bold text-white text-sm transition-colors">
              <Store className="w-4 h-4" />
              Abrir Painel do Lojista
            </Link>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block mb-1 font-bold text-slate-500 text-xs uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={form.email}
                disabled
                className="bg-slate-950 px-4 py-3 border border-slate-800 rounded-lg w-full text-slate-400"
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-500 text-xs uppercase tracking-wider">Nome de exibicao</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="Seu nome na comunidade"
                className="bg-slate-950 px-4 py-3 border border-slate-700 focus:border-orange-500 rounded-lg outline-none w-full text-white"
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-500 text-xs uppercase tracking-wider">URL do avatar</label>
              <input
                type="url"
                value={form.avatarUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                placeholder="https://..."
                className="bg-slate-950 px-4 py-3 border border-slate-700 focus:border-orange-500 rounded-lg outline-none w-full text-white"
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-500 text-xs uppercase tracking-wider">Telegram Chat ID</label>
              <input
                type="text"
                value={form.telegramChatId}
                onChange={(e) => setForm((prev) => ({ ...prev, telegramChatId: e.target.value }))}
                placeholder="Opcional, para alertas"
                className="bg-slate-950 px-4 py-3 border border-slate-700 focus:border-orange-500 rounded-lg outline-none w-full text-white"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {message && <p className="text-emerald-400 text-sm">{message}</p>}

            <div className="flex sm:flex-row flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex justify-center items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 px-4 py-3 rounded-lg font-bold text-white transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar alteracoes'}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-3 border border-slate-700 rounded-lg font-bold text-slate-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
