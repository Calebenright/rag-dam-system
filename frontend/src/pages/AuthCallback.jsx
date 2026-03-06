import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * OAuth callback page - used as a popup target when authenticating from an iframe.
 * Supabase redirects here after Google OAuth. This page reads the session,
 * posts it back to the opener window via postMessage, and closes itself.
 */
export default function AuthCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically processes the hash fragment on page load
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (session && window.opener) {
          // Post session back to the parent/opener window
          window.opener.postMessage(
            { type: 'dodeka-auth-success', accessToken: session.access_token },
            window.location.origin
          );
          // Give a moment for the message to deliver, then close
          setTimeout(() => window.close(), 300);
        } else if (!window.opener) {
          // Opened directly (not as popup) - redirect to app root
          window.location.href = '/';
        }
      } catch (err) {
        setError(err.message || 'Authentication failed');
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
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
