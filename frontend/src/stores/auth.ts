import axios from 'axios';
import { create } from 'zustand';
import { API_URL } from '../lib/config';
import { queryClient } from '../lib/queryClient';
import type { AuthUser } from '../lib/types';

// Access token lives in memory only. The refresh token is kept in localStorage so a reload
// keeps you signed in; moving it to an httpOnly cookie is a planned hardening step.
const REFRESH_KEY = 'devforge.refresh';
const http = axios.create({ baseURL: API_URL });

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Returns a fresh access token, or null if the session is gone. Concurrent calls share one request. */
  refresh: () => Promise<string | null>;
  bootstrap: () => Promise<void>;
}

// Refresh tokens rotate and a reused token revokes the whole session family,
// so two refreshes racing with the same token must never be sent.
let inflight: Promise<string | null> | null = null;

export const useAuth = create<AuthState>()((set, get) => {
  const apply = (data: AuthResponse) => {
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    set({ accessToken: data.accessToken, user: data.user });
  };
  const clear = () => {
    localStorage.removeItem(REFRESH_KEY);
    queryClient.clear(); // never show the previous user's cached data to the next one
    set({ accessToken: null, user: null });
  };

  return {
    accessToken: null,
    user: null,
    ready: false,

    async login(email, password) {
      const { data } = await http.post<AuthResponse>('/auth/login', { email, password });
      apply(data);
    },

    async logout() {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      clear();
      if (refreshToken) await http.post('/auth/logout', { refreshToken }).catch(() => undefined);
    },

    refresh() {
      inflight ??= (async () => {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return null;
        try {
          const { data } = await http.post<AuthResponse>('/auth/refresh', { refreshToken });
          apply(data);
          return data.accessToken;
        } catch {
          clear();
          return null;
        }
      })().finally(() => {
        inflight = null;
      });
      return inflight;
    },

    async bootstrap() {
      if (!get().ready) {
        await get().refresh();
        set({ ready: true });
      }
    },
  };
});
