import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

const ALLOWED_DOMAIN = 'dodekadigital.com';

// Detect if we're running inside an iframe
const isInIframe = () => {
  try { return window.self !== window.top; } catch { return true; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const email = session.user?.email || '';
        if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          setSession(session);
          setUser(session.user);
        } else {
          supabase.auth.signOut();
        }
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const email = session.user?.email || '';
          if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
            setSession(session);
            setUser(session.user);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Listen for auth from popup window (iframe flow)
  // Two mechanisms: postMessage (primary) + storage event (fallback)
  useEffect(() => {
    const refreshSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const email = session.user?.email || '';
        if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          setSession(session);
          setUser(session.user);
        }
      }
    };

    // Primary: popup sends postMessage after OAuth completes
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'dodeka-auth-success') return;
      refreshSession();
    };

    // Fallback: detect localStorage changes from the popup window
    // When the popup's Supabase client writes the session, this fires in the iframe
    const handleStorage = (event) => {
      if (event.key && event.key.includes('supabase') && event.key.includes('auth')) {
        refreshSession();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isInIframe()) {
      // Iframe flow: open OAuth in a popup window
      const callbackUrl = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: { hd: ALLOWED_DOMAIN },
          redirectTo: callbackUrl,
          skipBrowserRedirect: true, // don't navigate - we'll open a popup
        },
      });

      if (error) return { error };

      // Open the OAuth URL in a popup
      const w = 500, h = 600;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(data.url, 'dodeka-oauth', `width=${w},height=${h},left=${left},top=${top}`);

      return { error: null };
    }

    // Standard flow: full-page redirect
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { hd: ALLOWED_DOMAIN },
        redirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
    isIframe: isInIframe(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
