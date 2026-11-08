import { createHash, randomBytes } from 'crypto';

/** Cryptographically random, URL-safe token (hex). */
export const generateToken = (bytes = 32): string => randomBytes(bytes).toString('hex');

/** Only the hash of a token is ever stored; the raw value goes to the user. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
