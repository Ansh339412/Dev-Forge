import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorNote, Field, Input, Spinner } from '../components/ui';
import { del, get, patch, post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { fmtDateTime } from '../lib/format';
import type { Profile, SessionInfo } from '../lib/types';
import { useAuth } from '../stores/auth';
import { toast } from '../stores/toast';

export default function AccountPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const [name, setName] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  const profile = useQuery({ queryKey: ['me'], queryFn: () => get<Profile>('/users/me') });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => get<SessionInfo[]>('/auth/sessions') });
  useEffect(() => {
    if (profile.data) setName(profile.data.name);
  }, [profile.data]);

  const updateProfile = useMutation({
    mutationFn: (body: { name?: string; emailNotifications?: boolean }) => patch<Profile>('/users/me', body),
    onSuccess: (p) => {
      qc.setQueryData(['me'], (old: Profile | undefined) => (old ? { ...old, ...p } : p));
      const user = useAuth.getState().user;
      if (user) useAuth.setState({ user: { ...user, name: p.name } });
      toast.success('Saved');
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const changePassword = useMutation({
    mutationFn: () => post('/users/me/change-password', passwords),
    onSuccess: async () => {
      toast.success('Password changed. Sign in again with the new one.');
      await logout();
      navigate('/login');
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/auth/sessions/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sessions'] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  if (profile.isLoading) return <Spinner />;
  if (profile.isError || !profile.data) return <div className="p-6"><ErrorNote>{errMsg(profile.error)}</ErrorNote></div>;
  const p = profile.data;

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-6">
      <h1 className="text-xl font-semibold">Account</h1>

      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim() && name !== p.name) updateProfile.mutate({ name });
        }}
      >
        <h2 className="text-base font-semibold">Profile</h2>
        <Field label="Name">
          {(id) => <Input id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Email" hint="Your sign-in address cannot be changed here.">
          {(id) => <Input id={id} value={p.email} disabled readOnly />}
        </Field>
        <Button type="submit" variant="primary" loading={updateProfile.isPending} disabled={!name.trim() || name === p.name}>
          Save name
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Notifications</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.emailNotifications}
            disabled={updateProfile.isPending}
            onChange={(e) => updateProfile.mutate({ emailNotifications: e.target.checked })}
          />
          Email me about assignments, comments and due dates
        </label>
        <p className="text-xs text-muted">You always see these in the app. Invitation and password emails are always sent.</p>
      </section>

      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          changePassword.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Change password</h2>
        {changePassword.isError && <ErrorNote>{errMsg(changePassword.error)}</ErrorNote>}
        <Field label="Current password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />}
        </Field>
        <Field label="New password" hint="At least 10 characters. You will be signed out everywhere.">
          {(id) => <Input id={id} type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />}
        </Field>
        <Button type="submit" loading={changePassword.isPending}>Change password</Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Active sessions</h2>
        <ul className="divide-y divide-line border-y border-line bg-white">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{s.userAgent ?? 'Unknown device'}</span>
                <span className="text-xs text-muted">{s.ipAddress ?? 'Unknown IP'} · signed in {fmtDateTime(s.createdAt)}</span>
              </span>
              <Button variant="ghost" onClick={() => revoke.mutate(s.id)}>Sign out</Button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">If you sign out the session you are using, you will be asked to sign in again within 15 minutes.</p>
      </section>
    </div>
  );
}
