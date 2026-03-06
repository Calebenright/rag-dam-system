import { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * OAuth callback page - popup target when authenticating from an iframe.
 * Supabase redirects here after Google OAuth with a hash fragment.
 * This page waits for Supabase to process the token, posts the session
 * back to the opener window via postMessage, and closes itself.
 */
export default function AuthCallback() {
  const [error, setError] = useState(null);
  const closedRef = useRef(false);

  useEffect(() => {
    // Listen for Supabase to process the hash fragment and establish a session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (closedRef.current) return;

        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          closedRef.current = true;

          // Post message to the opener (iframe) window
          if (window.opener) {
            window.opener.postMessage(
              { type: 'dodeka-auth-success' },
              window.location.origin
            );
          }

          // Close popup after a short delay so the message delivers
          setTimeout(() => window.close(), 200);
        }
      }
    );

    // Fallback: if nothing happens in 10s, show an error
    const timeout = setTimeout(() => {
      if (!closedRef.current) {
        setError('Authentication timed out. Please close this window and try again.');
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-xs">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => window.close()}
              className="mt-3 text-xs text-neutral-400 hover:text-neutral-200 underline"
            >
              Close window
            </button>
          </div>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">Signing in...</p>
          </>
        )}
      </div>
    </div>
  );
}
