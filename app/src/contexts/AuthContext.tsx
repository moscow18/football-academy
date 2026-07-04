import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/types';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileCache = useRef<Record<string, UserProfile | null>>({});

  // Fetch user profile from our users table (with cache)
  async function fetchProfile(userId: string, forceRefresh = false) {
    if (!forceRefresh && profileCache.current[userId] !== undefined) {
      return profileCache.current[userId];
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      profileCache.current[userId] = null;
      return null;
    }
    const p = data as UserProfile;
    profileCache.current[userId] = p;
    return p;
  }

  useEffect(() => {
    let cancelled = false;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (!cancelled) setProfile(p);
      }
      if (!cancelled) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (cancelled) return;
        // Keep loading=true while we fetch the profile to prevent the inactive flash
        setLoading(true);
        setSession(s);
        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          if (!cancelled) setProfile(p);
        } else {
          setProfile(null);
        }
        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        let msg = error.message;
        if (typeof msg !== 'string') msg = JSON.stringify(msg);
        if (msg === 'Invalid login credentials' || msg === '{}') {
          return { error: 'بيانات تسجيل الدخول غير صحيحة' };
        }
        return { error: msg || 'حدث خطأ غير معروف' };
      }
      // loading will be set to false by onAuthStateChange after profile is fetched
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: err?.message || 'حدث خطأ في الاتصال' };
    }
  };

  const signOut = async () => {
    profileCache.current = {};
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

