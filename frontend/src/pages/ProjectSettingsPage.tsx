import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectFrame } from '../components/ProjectFrame';
import { Avatar, Button, ErrorNote, Field, Input, Select, Textarea } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { del, get, patch, post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { toDateInput } from '../lib/format';
import { PRIORITIES, PRIORITY_META, PROJECT_STATUS_LABEL, PROJECT_STATUSES, roleAtLeast } from '../lib/meta';
import { canEditProject } from '../lib/permissions';
import type { Member, Priority, Project, ProjectStatus, UserBrief } from '../lib/types';
import { useAuth } from '../stores/auth';
import { toast } from '../stores/toast';

export default function ProjectSettingsPage() {
  return <ProjectFrame>{(project) => <Settings project={project} />}</ProjectFrame>;
}

function Settings({ project }: { project: Project }) {
  const { workspace, role, isAdmin } = useWorkspace();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const wid = workspace.id;
  const base = `/workspaces/${wid}/projects/${project.id}`;
  const editable = canEditProject(project, me.id, role);

  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? '',
    status: project.status,
    priority: project.priority,
    deadline: toDateInput(project.deadline),
    managerId: project.managerId,
  });
  const [addUserId, setAddUserId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority,
      deadline: toDateInput(project.deadline),
      managerId: project.managerId,
    });
  }, [project]);

  const wsMembers = useQuery({ queryKey: ['ws', wid, 'members'], queryFn: () => get<Member[]>(`/workspaces/${wid}/members`) });
  const teamKey = ['ws', wid, 'project-members', project.id];
  const team = useQuery({ queryKey: teamKey, queryFn: () => get<{ user: UserBrief }[]>(`${base}/members`) });

  const refreshProject = () => {
    void qc.invalidateQueries({ queryKey: ['ws', wid, 'project', project.id] });
    void qc.invalidateQueries({ queryKey: ['ws', wid, 'projects'] });
  };
  const onError = (e: unknown) => toast.error(errMsg(e));

  const save = useMutation({
    mutationFn: () =>
      patch(base, {
        name: form.name,
        description: form.description,
        status: form.status,
        priority: form.priority,
        deadline: form.deadline || null,
        ...(isAdmin && form.managerId !== project.managerId ? { managerId: form.managerId } : {}),
      }),
    onSuccess: () => {
      refreshProject();
      void qc.invalidateQueries({ queryKey: teamKey });
      toast.success('Project saved');
    },
    onError,
  });
  const addMember = useMutation({
    mutationFn: () => post(`${base}/members`, { userId: addUserId }),
    onSuccess: () => {
      setAddUserId('');
      void qc.invalidateQueries({ queryKey: teamKey });
      refreshProject();
    },
    onError,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => del(`${base}/members/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKey });
      refreshProject();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => del(base),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ws', wid, 'projects'] });
      toast.success('Project deleted');
      navigate(`/w/${wid}/projects`);
    },
    onError,
  });

  const teamIds = new Set(team.data?.map((m) => m.user.id));
  const candidates = wsMembers.data?.filter((m) => roleAtLeast(m.role, 'DEVELOPER') && !teamIds.has(m.user.id)) ?? [];
  const managers = wsMembers.data?.filter((m) => roleAtLeast(m.role, 'PROJECT_MANAGER')) ?? [];

  return (
    <div className="space-y-10">
      {!editable && (
        <p className="rounded border border-line bg-white px-3 py-2 text-sm text-muted">
          Only the project manager or a workspace admin can change these settings.
        </p>
      )}

      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Details</h2>
        {save.isError && <ErrorNote>{errMsg(save.error)}</ErrorNote>}
        <Field label="Name">
          {(id) => <Input id={id} required minLength={2} maxLength={100} disabled={!editable} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Description">
          {(id) => <Textarea id={id} maxLength={2000} disabled={!editable} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Status">
            {(id) => (
              <Select id={id} disabled={!editable} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} disabled={!editable} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Deadline">
            {(id) => <Input id={id} type="date" disabled={!editable} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />}
          </Field>
          <Field label="Project manager">
            {(id) => (
              <Select id={id} disabled={!isAdmin} value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                {managers.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
                {!managers.some((m) => m.user.id === form.managerId) && <option value={form.managerId}>{project.manager.name}</option>}
              </Select>
            )}
          </Field>
        </div>
        {editable && <Button type="submit" variant="primary" loading={save.isPending}>Save changes</Button>}
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Team</h2>
        <ul className="divide-y divide-line border-y border-line bg-white">
          {team.data?.map((m) => (
            <li key={m.user.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={m.user.name} size={26} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {m.user.name}
                {m.user.id === project.managerId && <span className="ml-2 text-xs text-muted">Project manager</span>}
              </span>
              {editable && m.user.id !== project.managerId && (
                <Button variant="ghost" onClick={() => removeMember.mutate(m.user.id)}>Remove</Button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <div className="flex items-center gap-2">
            <Select aria-label="Add team member" className="w-64" value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">Choose a workspace member</option>
              {candidates.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
            <Button disabled={!addUserId} loading={addMember.isPending} onClick={() => addMember.mutate()}>Add to project</Button>
          </div>
        )}
        <p className="text-xs text-muted">Developers can only work on projects they belong to. Removing someone unassigns their tasks here.</p>
      </section>

      {isAdmin && (
        <section className="space-y-3 border-t border-line pt-6">
          <h2 className="text-base font-semibold">Delete project</h2>
          <p className="text-sm text-muted">This permanently deletes the project, its tasks, comments and attachments.</p>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Delete permanently</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep project</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmDelete(true)}>Delete project</Button>
          )}
        </section>
      )}
    </div>
  );
}
