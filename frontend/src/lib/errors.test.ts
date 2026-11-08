import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { errMsg } from './errors';

const apiError = (status: number, data: unknown) =>
  new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} } as never);

describe('errMsg', () => {
  it('uses the API message', () => expect(errMsg(apiError(400, { message: 'Invalid or expired token' }))).toBe('Invalid or expired token'));
  it('joins validation messages', () =>
    expect(errMsg(apiError(400, { message: ['email must be an email', 'password is too short'] }))).toBe(
      'email must be an email. password is too short',
    ));
  it('explains rate limiting', () => expect(errMsg(apiError(429, {}))).toMatch(/too many attempts/i));
  it('explains an unreachable server', () => expect(errMsg(new AxiosError('Network Error'))).toMatch(/cannot reach the server/i));
  it('has a safe fallback', () => expect(errMsg(new Error('boom'))).toBe('Something went wrong. Try again.'));
});
