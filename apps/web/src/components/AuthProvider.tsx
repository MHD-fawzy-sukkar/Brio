'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      // A missing session is a normal anonymous state, not an exception.
      if (response.status === 401) {
        setUser(null);
        return null;
      }
      if (!response.ok) {
        setUser(null);
        return null;
      }

      const data = await response.json().catch(() => null);
      const nextUser = (data?.creator || null) as AuthUser | null;
      setUser(nextUser);
      return nextUser;
    } catch {
      // Network/API failures must leave the UI in a safe anonymous state.
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The login page does not need to probe a protected endpoint. This also
    // prevents a harmless anonymous 401 from cluttering the login flow.
    if (pathname?.replace(/\/$/, '') === '/login') {
      setUser(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Clear local state even when the network is unavailable.
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
