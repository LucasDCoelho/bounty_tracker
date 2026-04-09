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
      <main className="flex justify-center items-center bg-background p-4 min-h-screen text-muted-foreground">
        Validando sessao...
      </main>
    );
  }

  return (
    <main className="flex justify-center items-center bg-background p-4 min-h-screen">
      <div className="bg-surface shadow-2xl shadow-black/10 p-8 border border-border rounded-2xl w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center items-center gap-2 bg-clip-text bg-linear-to-r from-primary to-secondary mb-2 font-black text-transparent text-3xl">
            BountyTracker <ShieldCheck className="w-8 h-8 text-primary" />
          </h1>
          <p className="text-muted-foreground">Entre para gerenciar sua carteira de TCG</p>
        </div>

        {error && <div className="bg-danger/10 mb-4 p-3 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>}
        {msg && <div className="bg-success/10 mb-4 p-3 border border-success/30 rounded-lg text-success text-sm">{msg}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block mb-1 font-bold text-muted-foreground text-xs uppercase tracking-wider">E-mail</label>
            <div className="relative">
              <Mail className="top-3 left-3 absolute w-5 h-5 text-muted-foreground" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background py-3 pr-4 pl-10 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground transition-colors"
                placeholder="pirata@grandline.com"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-bold text-muted-foreground text-xs uppercase tracking-wider">Senha</label>
            <div className="relative">
              <Lock className="top-3 left-3 absolute w-5 h-5 text-muted-foreground" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background py-3 pr-4 pl-10 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="flex justify-center items-center gap-2 bg-primary hover:bg-primary/90 mt-6 py-3 rounded-lg w-full font-bold text-primary-foreground transition-colors"
          >
            {loading ? "A processar..." : (isLogin ? "Entrar na Taverna" : "Criar Conta")}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 pt-6 border-border border-t text-center">
          <p className="text-muted-foreground text-sm">
            {isLogin ? "Ainda não tem um log pose?" : "Já faz parte da tripulação?"}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="ml-2 font-bold text-primary hover:underline"
            >
              {isLogin ? "Crie sua conta" : "Faça login"}
            </button>
          </p>
        </div>
        
        <Link href="/" className="block mt-4 text-muted-foreground hover:text-foreground text-xs text-center">
          Voltar ao Mercado Público
        </Link>
      </div>
    </main>
  );
}