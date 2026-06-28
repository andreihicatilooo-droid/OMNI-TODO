import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_ORIGIN = (() => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return window.location.origin;
  }
})();

const EMPTY_PROVIDERS = {
  google: { connected: false, user: null },
  github: { connected: false, user: null },
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState(EMPTY_PROVIDERS);
  const [configured, setConfigured] = useState({ google: false, github: false });

  const checkStatus = useCallback(async () => {
    try {
      setStatus('loading');
      const res = await fetch(`${API_URL}/auth/status`, { credentials: 'include' });
      if (!res.ok) throw new Error('Could not get auth status');
      const data = await res.json();

      const nextProviders = {
        google: {
          connected: Boolean(data?.google?.connected),
          user: data?.google?.user ? { provider: 'google', ...data.google.user } : null,
        },
        github: {
          connected: Boolean(data?.github?.connected || data?.copilot?.connected),
          user: data?.github?.user
            ? { provider: 'github', ...data.github.user }
            : data?.copilot?.user
              ? { provider: 'github', ...data.copilot.user }
              : null,
        },
      };

      setProviders(nextProviders);
      setConfigured({
        google: Boolean(data?.configured?.google),
        github: Boolean(data?.configured?.github),
      });

      const primaryUser = nextProviders.google.user || nextProviders.github.user || null;
      setUser(primaryUser);
      setStatus(primaryUser ? 'authenticated' : 'unauthenticated');
      setError(null);
    } catch (e) {
      setError(e.message);
      setProviders(EMPTY_PROVIDERS);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    checkStatus();

    const url = new URL(window.location.href);
    const authResult = url.searchParams.get('auth');
    const authMessage = url.searchParams.get('message');
    if (authResult) {
      if (authResult === 'error' && authMessage) {
        setError(authMessage);
      }

      url.searchParams.delete('auth');
      url.searchParams.delete('provider');
      url.searchParams.delete('message');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }

    const handleAuthMessage = (event) => {
      if (event.origin !== window.location.origin && event.origin !== API_ORIGIN) return;
      if (event.data?.error) {
        setError(event.data.error);
      }
      if (event.data?.provider || event.data?.error) {
        checkStatus();
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [checkStatus]);

  const login = (provider, method = 'popup') => {
    const width = 600, height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const frontendOrigin = window.location.origin;
    const url = `${API_URL}/auth/${provider}?mode=${encodeURIComponent(method)}&frontendOrigin=${encodeURIComponent(frontendOrigin)}`;

    if (method === 'redirect') {
      window.location.href = url;
      return;
    }

    window.open(url, 'auth-popup', `width=${width},height=${height},top=${top},left=${left}`);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { credentials: 'include' });
      setProviders(EMPTY_PROVIDERS);
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const disconnect = async (provider) => {
    try {
      const res = await fetch(`${API_URL}/auth/logout/${provider}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось отключить провайдера');
      }
      await checkStatus();
    } catch (e) {
      setError(e.message);
    }
  };

  return { 
    user, 
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    status,
    providers,
    configured,
    login, 
    logout,
    disconnect,
    refreshStatus: checkStatus,
    error 
  };
};
