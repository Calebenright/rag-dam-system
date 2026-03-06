import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Check for API key in URL params (used for ClickUp embed: ?key=xxx)
// Store it and strip from URL so it doesn't leak in referrer headers
const params = new URLSearchParams(window.location.search);
const embedApiKey = params.get('key');
if (embedApiKey) {
  sessionStorage.setItem('dodeka-embed-key', embedApiKey);
  // Clean the key from the URL bar
  const clean = new URL(window.location.href);
  clean.searchParams.delete('key');
  window.history.replaceState({}, '', clean.toString());
}
const storedApiKey = embedApiKey || sessionStorage.getItem('dodeka-embed-key');

export const hasEmbedKey = () => !!sessionStorage.getItem('dodeka-embed-key');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth (API key or JWT)
api.interceptors.request.use(
  async (config) => {
    const apiKey = sessionStorage.getItem('dodeka-embed-key');
    if (apiKey) {
      // Embed mode: use API key
      config.headers['X-API-Key'] = apiKey;
    } else {
      // Normal mode: use Supabase JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const apiKey = sessionStorage.getItem('dodeka-embed-key');
      if (!apiKey) {
        // Only sign out / redirect for JWT auth (not embed mode)
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
