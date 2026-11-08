import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../components/Overlay';
import { Avatar, Button, EmptyState, ErrorNote, Field, Input, ProgressBar, Select, Spinner, Textarea } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { get, post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { fmtDate } from '../lib/format';
import { PRIORITIES, PRIORITY_META, PROJECT_STATUS_LABEL } from '../lib/meta';
import type { Priority, Project } from '../lib/types';

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', priority: 'MEDIUM' as Priority, deadline: '' });

  const create = useMutation({
    mutationFn: () =>
      post<Project>(`/workspaces/${workspace.id}/projects`, {
        name: form.name,
        description: form.description || undefined,
        priority: form.priority,
        deadline: form.deadline || undefined,
      }),
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'projects'] });
      onClose();
      navigate(`/w/${workspace.id}/projects/${p.id}`);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        {create.isError && <ErrorNote>{errMsg(create.error)}</ErrorNote>}
        <Field label="Name">
          {(id) => <Input id={id} required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Description" hint="Optional.">
          {(id) => <Textarea id={id} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Deadline">
            {(id) => <Input id={id} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />}
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>Create project</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const { workspace, canManage } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ['ws', workspace.id, 'projects'],
    queryFn: () => get<Project[]>(`/workspaces/${workspace.id}/projects`),
  });

  return (
    <div className="p-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        {canManage && <Button variant="primary" onClick={() => setCreating(true)}>New project</Button>}
      </header>

      {q.isLoading && <Spinner />}
      {q.isError && <ErrorNote>{errMsg(q.error)}</ErrorNote>}
      {q.data && q.data.length === 0 && (
        <div className="border border-dashed border-line bg-white">
          <EmptyState title="No projects yet">
            {canManage ? 'Create the first project to start tracking tasks.' : 'A project manager can create the first project.'}
          </EmptyState>
        </div>
      )}
      {q.data && q.data.length > 0 && (
        <ul className="divide-y divide-line border-y border-line bg-white">
          {q.data.map((p) => (
            <li key={p.id}>
              <Link
                to={`/w/${workspace.id}/projects/${p.id}`}
                className="grid items-center gap-3 px-4 py-3 hover:bg-surface md:grid-cols-[minmax(0,3fr)_6rem_5rem_9rem_5rem_9rem]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  {p.description && <span className="block truncate text-sm text-muted">{p.description}</span>}
                </span>
                <span className="text-sm">{PROJECT_STATUS_LABEL[p.status]}</span>
                <span className={`text-sm ${PRIORITY_META[p.priority].text}`}>{PRIORITY_META[p.priority].label}</span>
                <span className="flex items-center gap-2 text-sm">
                  <Avatar name={p.manager.name} size={22} />
                  <span className="truncate">{p.manager.name}</span>
                </span>
                <span className="text-sm text-muted">{p.deadline ? fmtDate(p.deadline) : 'No deadline'}</span>
                <span className="text-xs text-muted">
                  <ProgressBar percent={p.completionPercent} label={`${p.name} completion`} />
                  <span className="mt-1 block">{p.taskCounts.COMPLETED} of {p._count.tasks} tasks done</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateProjectModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
