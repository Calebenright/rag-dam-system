import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 texture-dots flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 p-8 text-center">
          {/* Logo */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-pastel-mint/20 to-pastel-lavender/20 flex items-center justify-center border border-neutral-700">
            <Sparkles className="w-8 h-8 text-pastel-lavender" />
          </div>

          <h1 className="text-2xl font-semibold text-neutral-50 mb-2">
            Dodeka Internal
          </h1>
          <p className="text-neutral-500 mb-8">
            Sign in with your @dodekadigital.com account
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-all disabled:opacity-50"
          >
            {signingIn ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
            ) : (
              <>
                {/* Google Icon SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-neutral-200 font-medium">
                  Continue with Google
                </span>
              </>
            )}
          </button>

          <p className="mt-6 text-xs text-neutral-600">
            Access is limited to Dodeka Digital team members
          </p>
        </div>
      </div>
    </div>
  );
}
