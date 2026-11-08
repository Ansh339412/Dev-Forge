import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, ErrorNote, Field, Input, Select, Spinner } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { del, get, patch, post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { fmtDate } from '../lib/format';
import { ROLE_LABEL, ROLES } from '../lib/meta';
import type { Invitation, Member, WorkspaceRole } from '../lib/types';
import { useAuth } from '../stores/auth';
import { toast } from '../stores/toast';

export default function MembersPage() {
  const { workspace, isAdmin } = useWorkspace();
  const me = useAuth((s) => s.user)!;
  const wid = workspace.id;
  const base = `/workspaces/${wid}`;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [invite, setInvite] = useState({ email: '', role: 'DEVELOPER' as WorkspaceRole });

  const members = useQuery({ queryKey: ['ws', wid, 'members'], queryFn: () => get<Member[]>(`${base}/members`) });
  const invitations = useQuery({
    queryKey: ['ws', wid, 'invitations'],
    queryFn: () => get<Invitation[]>(`${base}/invitations`),
    enabled: isAdmin,
  });

  const onError = (e: unknown) => toast.error(errMsg(e));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['ws', wid, 'members'] });
    void qc.invalidateQueries({ queryKey: ['ws', wid, 'invitations'] });
  };

  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: WorkspaceRole }) => patch(`${base}/members/${v.userId}`, { role: v.role }),
    onSuccess: refresh,
    onError,
  });
  const removeMember = useMutation({ mutationFn: (userId: string) => del(`${base}/members/${userId}`), onSuccess: refresh, onError });
  const leave = useMutation({
    mutationFn: () => del(`${base}/members/me`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['workspaces'] });
      navigate('/workspaces');
    },
    onError,
  });
  const sendInvite = useMutation({
    mutationFn: () => post(`${base}/invitations`, invite),
    onSuccess: () => {
      toast.success(`Invitation sent to ${invite.email}`);
      setInvite({ ...invite, email: '' });
      refresh();
    },
    onError,
  });
  const revoke = useMutation({ mutationFn: (id: string) => del(`${base}/invitations/${id}`), onSuccess: refresh, onError });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-semibold">Members</h1>

      {members.isLoading && <Spinner />}
      {members.isError && <ErrorNote>{errMsg(members.error)}</ErrorNote>}
      <ul className="divide-y divide-line border-y border-line bg-white">
        {members.data?.map((m) => (
          <li key={m.user.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.user.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.user.name}{m.user.id === me.id && ' (you)'}</span>
              <span className="block truncate text-sm text-muted">{m.user.email}</span>
            </span>
            {isAdmin ? (
              <Select
                aria-label={`Role for ${m.user.name}`}
                className="w-44"
                value={m.role}
                onChange={(e) => changeRole.mutate({ userId: m.user.id, role: e.target.value as WorkspaceRole })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            ) : (
              <span className="text-sm text-muted">{ROLE_LABEL[m.role]}</span>
            )}
            {m.user.id === me.id ? (
              <Button variant="ghost" onClick={() => leave.mutate()}>Leave</Button>
            ) : (
              isAdmin && <Button variant="ghost" onClick={() => removeMember.mutate(m.user.id)}>Remove</Button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Invite someone</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              sendInvite.mutate();
            }}
          >
            <div className="min-w-[14rem] flex-1">
              <Field label="Email">
                {(id) => <Input id={id} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />}
              </Field>
            </div>
            <div className="w-48">
              <Field label="Role">
                {(id) => (
                  <Select id={id} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as WorkspaceRole })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <Button type="submit" variant="primary" loading={sendInvite.isPending}>Send invitation</Button>
          </form>

          {invitations.data && invitations.data.length > 0 && (
            <ul className="divide-y divide-line border-y border-line bg-white">
              {invitations.data.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    {i.email} <span className="text-muted">as {ROLE_LABEL[i.role]}, expires {fmtDate(i.expiresAt)}</span>
                  </span>
                  <Button variant="ghost" onClick={() => revoke.mutate(i.id)}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
