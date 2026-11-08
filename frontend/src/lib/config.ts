// Same-origin by default: Vite (dev) and nginx (prod) proxy /api and /socket.io to the backend.
export const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
