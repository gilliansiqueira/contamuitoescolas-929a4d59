import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'cliente';

export interface UserProfile {
  user_id: string;
  email: string;
  school_id: string | null;
  role: UserRole;
  /** IDs adicionais (tabela user_schools) — combinados com school_id formam o conjunto acessível */
  extra_school_ids: string[];
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  /** Conjunto de school_ids que o usuário pode acessar (principal + extras). Para admin, vazio = todas. */
  accessibleSchoolIds: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const [{ data: profile }, { data: roles }, { data: extras }] = await Promise.all([
    supabase.from('profiles').select('user_id, email, school_id').eq('user_id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('user_schools').select('school_id').eq('user_id', userId),
  ]);
  if (!profile) return null;
  const role: UserRole = roles?.some(r => r.role === 'admin') ? 'admin' : 'cliente';
  const extra_school_ids = (extras ?? []).map((r: any) => r.school_id).filter(Boolean);
  return { ...profile, role, extra_school_ids };
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

  const accessibleSchoolIds = useMemo<string[]>(() => {
    if (!profile) return [];
    const ids = new Set<string>();
    if (profile.school_id) ids.add(profile.school_id);
    profile.extra_school_ids.forEach(id => ids.add(id));
    return Array.from(ids);
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin: profile?.role === 'admin',
        accessibleSchoolIds,
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
