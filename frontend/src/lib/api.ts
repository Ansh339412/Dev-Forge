import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '../stores/auth';
import { API_URL } from './config';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

// On 401, get a new access token once and replay the request.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const skip = NO_REFRESH.some((p) => original?.url?.startsWith(p));
    if (error.response?.status === 401 && original && !original._retried && !skip) {
      original._retried = true;
      const token = await useAuth.getState().refresh();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export const get = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<T>(url, { params }).then((r) => r.data);
export const post = <T>(url: string, body?: unknown) => api.post<T>(url, body).then((r) => r.data);
export const patch = <T>(url: string, body?: unknown) => api.patch<T>(url, body).then((r) => r.data);
export const del = (url: string) => api.delete(url).then(() => undefined);
