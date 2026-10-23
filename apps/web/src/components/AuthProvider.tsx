'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  acceptSession: (nextUser: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'brio_auth_cache_v1';
let memoryAuthCache: { user: AuthUser | null; resolved: boolean } = { user: null, resolved: false };

function readCachedAuth(): { user: AuthUser | null; resolved: boolean } {
  if (memoryAuthCache.resolved) return memoryAuthCache;
  if (typeof window === 'undefined') return { user: null, resolved: false };
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY) ?? window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { user: null, resolved: false };
    const parsed = JSON.parse(raw) as { user?: AuthUser | null };
    memoryAuthCache = { user: parsed?.user || null, resolved: true };
    return memoryAuthCache;
  } catch {
    return { user: null, resolved: false };
  }
}

function writeCachedAuth(user: AuthUser | null) {
  memoryAuthCache = { user, resolved: true };
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify({ user });
    window.localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota or privacy mode errors.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, '') || '';
  const isLoginRoute = normalizedPath === '/login';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!isLoginRoute);
  const hasVerifiedRef = useRef(false);

  const acceptSession = useCallback((nextUser: AuthUser | null) => {
    writeCachedAuth(nextUser);
    hasVerifiedRef.current = true;
    setUser(nextUser);
    setLoading(false);
  }, []);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      // A missing session is a normal anonymous state, not an exception.
      if (response.status === 401 || !response.ok) {
        writeCachedAuth(null);
        setUser(null);
        return null;
      }

      const data = await response.json().catch(() => null);
      const nextUser = (data?.creator || null) as AuthUser | null;
      writeCachedAuth(nextUser);
      setUser(nextUser);
      return nextUser;
    } catch {
      // Network/API failures must leave the UI in a safe anonymous state.
      writeCachedAuth(null);
      setUser(null);
      return null;
    } finally {
      hasVerifiedRef.current = true;
      setLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (isLoginRoute) {
      setLoading(false);
      return;
    }
    const cached = readCachedAuth();
    if (cached.resolved) {
      setUser(cached.user);
      setLoading(false);
    }
  }, [isLoginRoute]);

  useEffect(() => {
    // The login page does not need to probe a protected endpoint. This also
    // prevents a harmless anonymous 401 from cluttering the login flow.
    if (isLoginRoute) {
      setLoading(false);
      return;
    }
    if (hasVerifiedRef.current) {
      return;
    }
    void refresh();
  }, [isLoginRoute, refresh]);

  const logout = useCallback(async () => {
    writeCachedAuth(null);
    setUser(null);
    setLoading(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Clear local state even when the network is unavailable.
    }
  }, []);

  const effectiveLoading = isLoginRoute ? false : loading;
  const value = useMemo(
    () => ({ user, loading: effectiveLoading, refresh, acceptSession, logout }),
    [user, effectiveLoading, refresh, acceptSession, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
