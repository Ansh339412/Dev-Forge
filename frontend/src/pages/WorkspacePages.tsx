import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ErrorNote, Field, Input, Spinner, Textarea } from '../components/ui';
import { post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { ROLE_LABEL } from '../lib/meta';
import { useWorkspaces } from '../lib/queries';
import type { Workspace, WorkspaceRole } from '../lib/types';
import { useAuth } from '../stores/auth';

const LAST_KEY = 'devforge.ws';

/** "/" goes to the last workspace you used, or to workspace creation on first run. */
export function HomeRedirect() {
  const q = useWorkspaces();
  if (q.isLoading) return <Spinner />;
  const list = q.data ?? [];
  if (!list.length) return <Navigate to="/workspaces" replace />;
  const last = localStorage.getItem(LAST_KEY);
  const target = list.find((w) => w.id === last) ?? list[0];
  return <Navigate to={`/w/${target.id}/dashboard`} replace />;
}

export function WorkspacesPage() {
  const q = useWorkspaces();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => post<Workspace>('/workspaces', { name, description: description || undefined }),
    onSuccess: async (ws) => {
      await qc.invalidateQueries({ queryKey: ['workspaces'] });
      navigate(`/w/${ws.id}/dashboard`);
    },
  });

  const list = q.data ?? [];
  return (
    <div className="mx-auto max-w-2xl p-6 pt-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <div className="flex items-center gap-3 text-sm text-muted">
          {user?.name}
          <Button variant="ghost" onClick={() => void logout()}>Sign out</Button>
        </div>
      </header>

      {q.isLoading ? (
        <Spinner />
      ) : list.length > 0 ? (
        <ul className="mb-10 divide-y divide-line border-y border-line bg-white">
          {list.map((w) => (
            <li key={w.id}>
              <Link to={`/w/${w.id}/dashboard`} className="flex items-center justify-between px-4 py-3 hover:bg-surface">
                <span className="font-medium">{w.name}</span>
                <span className="text-sm text-muted">{ROLE_LABEL[w.role as WorkspaceRole]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-8 text-muted">You are not in a workspace yet. Create one to start planning, or open an invitation link from your email.</p>
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4 border-t border-line pt-6"
      >
        <h2 className="text-base font-semibold">Create a workspace</h2>
        {create.isError && <ErrorNote>{errMsg(create.error)}</ErrorNote>}
        <Field label="Name">
          {(id) => <Input id={id} required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Description" hint="Optional.">
          {(id) => <Textarea id={id} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" loading={create.isPending}>Create workspace</Button>
      </form>
    </div>
  );
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Triggered by a click, not on load: the invitation token is single-use.
  const accept = useMutation({
    mutationFn: () => post<{ workspaceId: string }>('/invitations/accept', { token }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['workspaces'] });
      navigate(`/w/${res.workspaceId}/dashboard`, { replace: true });
    },
  });

  return (
    <div className="mx-auto max-w-md p-6 pt-20">
      <h1 className="text-2xl font-semibold">Join a workspace</h1>
      <p className="mt-2 text-muted">You need to be signed in with the email address the invitation was sent to.</p>
      {accept.isError && <div className="mt-4"><ErrorNote>{errMsg(accept.error)}</ErrorNote></div>}
      <Button variant="primary" className="mt-6" loading={accept.isPending} disabled={!token} onClick={() => accept.mutate()}>
        Accept invitation
      </Button>
    </div>
  );
}
