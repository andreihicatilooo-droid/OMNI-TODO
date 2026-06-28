import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProviders = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);

      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const authWindow = window.open(
        `/api/auth/gemini/start?origin=${window.location.origin}`,
        'GoogleAuth',
        `width=${width},height=${height},toolbar=no,menubar=no,location=no,status=no,directories=no,scrollbars=yes,resizable=yes,left=${left},top=${top}`
      );

      const messageListener = (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.source === 'omni-oauth') {
          if (event.data.ok) {
            checkAuthStatus();
          } else {
            setError(event.data.error);
          }
          authWindow?.close();
          window.removeEventListener('message', messageListener);
          setLoading(false);
        }
      };

      window.addEventListener('message', messageListener);

      const checkWindowClosed = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkWindowClosed);
          setLoading(false);
          window.removeEventListener('message', messageListener);
        }
      }, 500);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const signOutGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/auth/gemini/disconnect', { method: 'POST' });
      const data = await response.json();
      if (data.ok) {
        setUser(null);
        setIsAuthenticated(false);
      } else {
        setError('Failed to disconnect from Google.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      if (data.gemini?.connected) {
        setUser({ name: data.gemini.account, provider: 'gemini' });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      setError('Failed to load authentication status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const authContextValue = {
    user,
    isAuthenticated,
    loading,
    error,
    signInWithGoogle,
    signOutGoogle,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProviders;
