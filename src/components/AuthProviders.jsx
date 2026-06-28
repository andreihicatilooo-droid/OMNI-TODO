import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProviders = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to initiate Google OAuth login
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);

      // Open a new window for OAuth
      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const authWindow = window.open(
        `/api/auth/gemini/start?origin=${window.location.origin}`,
        'GoogleAuth',
        `width=${width},height=${height},toolbar=no,menubar=no,location=no,status=no,directories=no,scrollbars=yes,resizable=yes,left=${left},top=${top}`
      );

      // Listen for messages from the OAuth popup
      const messageListener = (event) => {
        if (event.origin !== window.location.origin) return; // Only accept messages from our origin
        if (event.data.source === 'omni-oauth') {
          if (event.data.ok) {
            console.log('Google Auth success:', event.data);
            checkAuthStatus(); // Re-check status after successful login
          } else {
            console.error('Google Auth error:', event.data.error);
            setError(event.data.error);
          }
          authWindow?.close();
          window.removeEventListener('message', messageListener);
          setLoading(false);
        }
      };

      window.addEventListener('message', messageListener);

      // If the popup is closed manually before completing, set loading to false
      const checkWindowClosed = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkWindowClosed);
          setLoading(false);
          window.removeEventListener('message', messageListener);
          // If no error was set, and user is not authenticated, it means user closed popup
          if (!isAuthenticated && !error) {
            setError('Authentication window closed by user.');
          }
        }
      }, 500);

    } catch (err) {
      console.error('Error initiating Google sign-in:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Function to sign out from Google
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
      console.error('Error signing out from Google:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to check current authentication status
  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      if (data.gemini?.connected) {
        setUser({ name: data.gemini.account, provider: 'gemini' }); // Simplified user object
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
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