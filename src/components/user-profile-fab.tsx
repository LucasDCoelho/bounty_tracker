"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import { User } from 'lucide-react';
import { useAuthSession } from '@/hooks/use-auth-session';

export default function UserProfileFab() {
  const { session } = useAuthSession();
  const user = session?.user || null;
  const metadata = user?.user_metadata || {};
  const avatarUrl = metadata.avatar_url || metadata.picture || metadata.photoURL;

  const fallbackInitial = useMemo(() => {
    const char = user?.email?.trim()?.charAt(0)?.toUpperCase();
    return char || 'U';
  }, [user?.email]);

  const href = user ? '/perfil' : '/login';
  const label = user ? 'Abrir perfil' : 'Fazer login';

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="top-4 right-4 z-50 fixed flex justify-center items-center bg-slate-900/95 hover:bg-slate-800 shadow-xl backdrop-blur-sm border border-slate-700 rounded-full w-11 h-11 text-slate-100 transition-all"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar do usuario"
          className="rounded-full w-full h-full object-cover"
        />
      ) : user ? (
        <span className="font-black text-sm">{fallbackInitial}</span>
      ) : (
        <User className="w-5 h-5" />
      )}
      <span className={`right-0 bottom-0 absolute border-2 border-slate-900 rounded-full w-3 h-3 ${user ? 'bg-emerald-500' : 'bg-slate-500'}`} />
    </Link>
  );
}
