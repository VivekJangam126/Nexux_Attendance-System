import { useSyncExternalStore, useCallback } from 'react';
import Auth from '../services/auth';
import Storage from '../services/storage';

/**
 * useAuth Hook
 * 
 * Provides reactive access to authentication state.
 * Uses useSyncExternalStore to subscribe to localStorage changes.
 * 
 * Returns:
 * - user: Current user object or null
 * - isLoggedIn: boolean
 * - role: Current user's role or null
 * - login: Login function
 * - logout: Logout function
 */

// Subscribe function for useSyncExternalStore
const subscribe = (callback) => {
  // Listen for storage events (for cross-tab sync)
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

// Get snapshot of current auth state
const getSnapshot = () => {
  const session = Storage.getSession();
  return session ? JSON.stringify(session) : null;
};

function useAuth() {
  // Subscribe to auth state changes
  // The snapshot value itself triggers re-renders when auth state changes
  useSyncExternalStore(subscribe, getSnapshot);
  
  const user = Auth.getCurrentUser();
  const isLoggedIn = Auth.isLoggedIn();
  const role = Auth.getCurrentRole();

  const login = useCallback((email, password) => {
    return Auth.login(email, password);
  }, []);

  const logout = useCallback(() => {
    Auth.logout();
  }, []);

  return {
    user,
    isLoggedIn,
    role,
    login,
    logout
  };
}

export default useAuth;
