'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Role = 'admin' | 'director' | 'editor_revista' | 'editor_libros' | 'coord_libros' | 'asistente';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  journal_id: string | null;
  avatar_url: string | null;
  active: boolean;
}

// Module access matrix: role -> modules -> 'full' | 'read' | false
const ACCESS_MATRIX: Record<Role, Record<string, 'full' | 'read' | false>> = {
  admin: {
    dashboard: 'full', planner: 'full', journals: 'full', books: 'full', finances: 'full',
    certificates: 'full', policies: 'full', 'editors-school': 'full',
    reports: 'full', settings: 'full', team: 'full',
  },
  director: {
    dashboard: 'full', planner: 'full', journals: 'full', books: 'full', finances: 'full',
    certificates: 'full', policies: 'full', 'editors-school': 'full',
    reports: 'full', settings: false, team: 'full',
  },
  editor_revista: {
    dashboard: 'full', planner: 'full', journals: 'full', books: false, finances: false,
    certificates: 'full', policies: 'read', 'editors-school': 'full',
    reports: 'read', settings: false, team: 'read',
  },
  editor_libros: {
    dashboard: 'full', planner: 'full', journals: 'full', books: 'full', finances: false,
    certificates: 'full', policies: 'read', 'editors-school': 'full',
    reports: 'read', settings: false, team: 'read',
  },
  coord_libros: {
    dashboard: 'full', planner: 'full', journals: false, books: 'full', finances: false,
    certificates: 'full', policies: 'read', 'editors-school': false,
    reports: 'read', settings: false, team: 'read',
  },
  asistente: {
    dashboard: 'read', planner: 'read', journals: 'read', books: 'read', finances: false,
    certificates: false, policies: 'read', 'editors-school': 'read',
    reports: 'read', settings: false, team: 'read',
  },
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  hasAccess: (module: string) => boolean;
  isReadOnly: (module: string) => boolean;
  accessLevel: (module: string) => 'full' | 'read' | false;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true,
  hasAccess: () => false, isReadOnly: () => true,
  accessLevel: () => false, signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) console.error('Error fetching profile:', error);
    setProfile(data as UserProfile | null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(u);
      if (u) await fetchProfile(u.id);
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await fetchProfile(u.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [supabase, fetchProfile]);

  const hasAccess = useCallback((module: string): boolean => {
    if (!profile) return false;
    const access = ACCESS_MATRIX[profile.role]?.[module];
    return access === 'full' || access === 'read';
  }, [profile]);

  const isReadOnly = useCallback((module: string): boolean => {
    if (!profile) return true;
    return ACCESS_MATRIX[profile.role]?.[module] === 'read';
  }, [profile]);

  const accessLevel = useCallback((module: string): 'full' | 'read' | false => {
    if (!profile) return false;
    return ACCESS_MATRIX[profile.role]?.[module] || false;
  }, [profile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, hasAccess, isReadOnly, accessLevel, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
