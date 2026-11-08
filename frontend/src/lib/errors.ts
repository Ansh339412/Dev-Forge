import { isAxiosError } from 'axios';

/** Turns an API error into one readable sentence. */
export function errMsg(err: unknown): string {
  if (isAxiosError(err)) {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
    if (err.response?.status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (!err.response) return 'Cannot reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Try again.';
}
