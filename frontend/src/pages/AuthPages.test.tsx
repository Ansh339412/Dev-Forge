import { AxiosError } from 'axios';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { post } from '../lib/api';
import { useAuth } from '../stores/auth';
import { LoginPage, VerifyEmailPage } from './AuthPages';

vi.mock('../lib/api', () => ({ post: vi.fn() }));

const apiError = (status: number, message: string) =>
  new AxiosError('failed', String(status), undefined, undefined, { status, data: { message }, statusText: '', headers: {}, config: {} } as never);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(post).mockReset();
    useAuth.setState({ user: null, accessToken: null });
  });

  async function signIn(loginResult: Promise<void>) {
    useAuth.setState({ login: vi.fn().mockReturnValue(loginResult) });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'whatever-123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    return user;
  }

  it('shows the API error for wrong credentials', async () => {
    await signIn(Promise.reject(apiError(401, 'Invalid credentials')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.queryByRole('button', { name: /resend verification/i })).not.toBeInTheDocument();
  });

  it('offers to resend the verification email when the account is unverified', async () => {
    vi.mocked(post).mockResolvedValue({});
    const user = await signIn(Promise.reject(apiError(403, 'Please verify your email before logging in')));
    await user.click(await screen.findByRole('button', { name: /resend verification email/i }));
    expect(post).toHaveBeenCalledWith('/auth/resend-verification', { email: 'ada@example.com' });
  });
});

describe('VerifyEmailPage', () => {
  it('spends the single-use token only once, even in StrictMode', async () => {
    vi.mocked(post).mockReset().mockResolvedValue({});
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/verify-email?token=abc123']}>
          <Routes><Route path="/verify-email" element={<VerifyEmailPage />} /></Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/auth/verify-email', { token: 'abc123' });
  });

  it('explains a link without a token', () => {
    render(<MemoryRouter initialEntries={['/verify-email']}><Routes><Route path="/verify-email" element={<VerifyEmailPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
  });
});
