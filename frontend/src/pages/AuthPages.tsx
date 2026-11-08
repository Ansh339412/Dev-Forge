import { isAxiosError } from 'axios';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button, ErrorNote, Field, Input } from '../components/ui';
import { post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { useAuth } from '../stores/auth';
import { toast } from '../stores/toast';

const Heading = ({ title, sub }: { title: string; sub?: string }) => (
  <header className="mb-6">
    <h1 className="text-2xl font-semibold">{title}</h1>
    {sub && <p className="mt-1 text-muted">{sub}</p>}
  </header>
);

export function LoginPage() {
  const user = useAuth((s) => s.user);
  const login = useAuth((s) => s.login);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
      setUnverified(isAxiosError(err) && err.response?.status === 403);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await post('/auth/resend-verification', { email });
      toast.success('Verification email sent. Check your inbox.');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <>
      <Heading title="Sign in" sub="Welcome back." />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        {unverified && (
          <Button type="button" variant="secondary" onClick={resend} disabled={!email}>
            Resend verification email
          </Button>
        )}
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted">
        <Link to="/forgot-password" className="underline">Forgot your password?</Link>
        <span className="mx-2">|</span>
        <Link to="/register" className="underline">Create an account</Link>
      </p>
    </>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await post('/auth/register', form);
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <Heading title="Check your email" sub={`We sent a confirmation link to ${form.email}. It is valid for 24 hours.`} />
        <Link to="/login" className="text-sm underline">Back to sign in</Link>
      </>
    );
  }
  return (
    <>
      <Heading title="Create your account" />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="Full name">
          {(id) => <Input id={id} autoComplete="name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          {(id) => <Input id={id} type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        <Button type="submit" variant="primary" loading={loading} className="w-full">Create account</Button>
      </form>
      <p className="mt-5 text-sm text-muted">
        Already registered? <Link to="/login" className="underline">Sign in</Link>
      </p>
    </>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const started = useRef(false); // the token is single-use; StrictMode must not spend it twice
  const [state, setState] = useState<'working' | 'ok' | 'error'>(token ? 'working' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its token.');

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((err) => {
        setState('error');
        setMessage(errMsg(err));
      });
  }, [token]);

  if (state === 'working') return <Heading title="Verifying your email" />;
  if (state === 'ok') {
    return (
      <>
        <Heading title="Email verified" sub="Your account is ready." />
        <Link to="/login" className="text-sm underline">Sign in</Link>
      </>
    );
  }
  return (
    <>
      <Heading title="This link did not work" sub={message} />
      <Link to="/login" className="text-sm underline">Go to sign in to request a new link</Link>
    </>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return <Heading title="Check your email" sub="If that account exists, a reset link is on its way. It is valid for 1 hour." />;
  }
  return (
    <>
      <Heading title="Reset your password" sub="We will email you a link." />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="Email">
          {(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" loading={loading} className="w-full">Send reset link</Button>
      </form>
      <p className="mt-5 text-sm"><Link to="/login" className="underline text-muted">Back to sign in</Link></p>
    </>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <Heading title="Password updated" sub="You were signed out everywhere. Sign in with your new password." />
        <Link to="/login" className="text-sm underline">Sign in</Link>
      </>
    );
  }
  return (
    <>
      <Heading title="Choose a new password" />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="New password" hint="At least 10 characters.">
          {(id) => <Input id={id} type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" loading={loading} className="w-full" disabled={!token}>Set new password</Button>
      </form>
    </>
  );
}
