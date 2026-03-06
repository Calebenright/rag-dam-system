import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasEmbedKey } from '../api/axios';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Embed mode: API key in sessionStorage - skip OAuth entirely
  if (hasEmbedKey()) {
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
