import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'cliente';

export interface UserProfile {
  user_id: string;
  email: string;
  school_id: string | null;
  role: UserRole;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('user_id, email, school_id').eq('user_id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);
  if (!profile) return null;
  const role: UserRole = roles?.some(r => r.role === 'admin') ? 'admin' : 'cliente';
  return { ...profile, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listener PRIMEIRO (síncrono para evitar deadlock)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer chamada async ao supabase
        setTimeout(() => {
          loadProfile(newSession.user.id).then(setProfile);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    // 2. Recupera sessão existente
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfile(existing.user.id).then(setProfile).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await loadProfile(user.id);
      setProfile(p);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin: profile?.role === 'admin',
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
