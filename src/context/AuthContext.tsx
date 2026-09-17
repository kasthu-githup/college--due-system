import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { clientDb } from '../lib/clientStorage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cnd_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('cnd_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setUser(data.user);
        setToken(savedToken);
      } else {
        const localUsers = clientDb.getUsers();
        const matched = localUsers.find(u => savedToken.includes(u.id)) || localUsers[0];
        if (matched) {
          setUser(matched);
          setToken(savedToken);
        } else {
          localStorage.removeItem('cnd_token');
          setUser(null);
          setToken(null);
        }
      }
    } catch (err) {
      console.error('Session verify error:', err);
      const localUsers = clientDb.getUsers();
      const matched = localUsers.find(u => savedToken.includes(u.id)) || localUsers[0];
      if (matched) {
        setUser(matched);
        setToken(savedToken);
      } else {
        setUser(null);
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') || res.status === 404) {
        const localRes = clientDb.login(cleanUser, cleanPass);
        if (localRes) {
          localStorage.setItem('cnd_token', localRes.token);
          setToken(localRes.token);
          setUser(localRes.user);
          return { success: true };
        }
        return {
          success: false,
          error: 'Authentication failed. Please verify your credentials.'
        };
      }

      const data = await res.json();
      if (!res.ok) {
        const localRes = clientDb.login(cleanUser, cleanPass);
        if (localRes) {
          localStorage.setItem('cnd_token', localRes.token);
          setToken(localRes.token);
          setUser(localRes.user);
          return { success: true };
        }
        return { success: false, error: data.error || 'Authentication failed. Please verify your credentials.' };
      }

      localStorage.setItem('cnd_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      const localRes = clientDb.login(cleanUser, cleanPass);
      if (localRes) {
        localStorage.setItem('cnd_token', localRes.token);
        setToken(localRes.token);
        setUser(localRes.user);
        return { success: true };
      }
      return { success: false, error: err.message || 'Connection error. Please retry.' };
    }
  };

  const logout = async () => {
    const savedToken = localStorage.getItem('cnd_token');
    if (savedToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${savedToken}` },
        });
      } catch (e) {
        // ignore
      }
    }
    localStorage.removeItem('cnd_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
