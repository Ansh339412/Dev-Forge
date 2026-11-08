import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAuth } from '../stores/auth';
import RequireAuth from './RequireAuth';

const app = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/private" element={<p>secret page</p>} />
      </Route>
      <Route path="/login" element={<p>login page</p>} />
    </Routes>
  </MemoryRouter>
);

describe('RequireAuth', () => {
  it('sends signed-out visitors to the sign-in page', () => {
    useAuth.setState({ ready: true, user: null, accessToken: null });
    render(app('/private'));
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });

  it('waits for the session check instead of flashing the sign-in page', () => {
    useAuth.setState({ ready: false, user: null, accessToken: null, bootstrap: async () => undefined });
    render(app('/private'));
    expect(screen.getByRole('status')).toHaveTextContent(/signing you in/i);
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
