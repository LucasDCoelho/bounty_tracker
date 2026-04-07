"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthSession } from '@/hooks/use-auth-session';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const { session, loading: loadingSession } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loadingSession && session) {
      router.replace('/');
    }
  }, [loadingSession, router, session]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");

    if (isLogin) {
      // Tenta Logar
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else if (data.session) {
        router.replace('/');
        router.refresh();
      }
    } else {
      // Tenta Cadastrar
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMsg("Conta criada! Confirme seu email (ou faça login direto se o Supabase não exigir confirmação no seu setup).");
    }
    setLoading(false);
  };

  if (loadingSession) {
    return (
      <main className="flex justify-center items-center bg-slate-950 p-4 min-h-screen text-slate-300">
        Validando sessao...
      </main>
    );
  }

  return (
    <main className="flex justify-center items-center bg-slate-950 p-4 min-h-screen">
      <div className="bg-slate-900 shadow-2xl p-8 border border-slate-800 rounded-2xl w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center items-center gap-2 bg-clip-text bg-linear-to-r from-orange-500 to-amber-300 mb-2 font-black text-transparent text-3xl">
            BountyTracker <ShieldCheck className="w-8 h-8 text-orange-500" />
          </h1>
          <p className="text-slate-400">Entre para gerenciar sua carteira de TCG</p>
        </div>

        {error && <div className="bg-red-500/10 mb-4 p-3 border border-red-500/50 rounded-lg text-red-500 text-sm">{error}</div>}
        {msg && <div className="bg-emerald-500/10 mb-4 p-3 border border-emerald-500/50 rounded-lg text-emerald-500 text-sm">{msg}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block mb-1 font-bold text-slate-500 text-xs uppercase tracking-wider">E-mail</label>
            <div className="relative">
              <Mail className="top-3 left-3 absolute w-5 h-5 text-slate-500" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 py-3 pr-4 pl-10 border border-slate-700 focus:border-orange-500 rounded-lg outline-none w-full text-white transition-colors"
                placeholder="pirata@grandline.com"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-bold text-slate-500 text-xs uppercase tracking-wider">Senha</label>
            <div className="relative">
              <Lock className="top-3 left-3 absolute w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 py-3 pr-4 pl-10 border border-slate-700 focus:border-orange-500 rounded-lg outline-none w-full text-white transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="flex justify-center items-center gap-2 bg-orange-600 hover:bg-orange-500 mt-6 py-3 rounded-lg w-full font-bold text-white transition-colors"
          >
            {loading ? "A processar..." : (isLogin ? "Entrar na Taverna" : "Criar Conta")}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 pt-6 border-slate-800 border-t text-center">
          <p className="text-slate-400 text-sm">
            {isLogin ? "Ainda não tem um log pose?" : "Já faz parte da tripulação?"}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="ml-2 font-bold text-orange-500 hover:underline"
            >
              {isLogin ? "Crie sua conta" : "Faça login"}
            </button>
          </p>
        </div>
        
        <Link href="/" className="block mt-4 text-slate-600 hover:text-slate-400 text-xs text-center">
          Voltar ao Mercado Público
        </Link>
      </div>
    </main>
  );
}