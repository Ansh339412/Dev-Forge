import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Drawer } from '../components/Overlay';
import { Avatar, Button, ErrorNote, Field, Input, Select, Spinner, Textarea } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { api, del, get, patch, post } from '../lib/api';
import { errMsg } from '../lib/errors';
import { fmtBytes, fmtDateTime, toDateInput } from '../lib/format';
import { PRIORITIES, PRIORITY_META, STATUS_META, STATUSES } from '../lib/meta';
import type { Attachment, Comment, Label, Priority, Task, TaskStatus, UserBrief } from '../lib/types';
import { useAuth } from '../stores/auth';
import { toast } from '../stores/toast';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,application/json,application/zip';
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  wid: string;
  projectId: string;
  taskId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function TaskDrawer({ taskId, ...rest }: Props) {
  return (
    <Drawer open={!!taskId} onClose={rest.onClose} title="Task details">
      {taskId && <TaskDetails key={taskId} taskId={taskId} {...rest} />}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function TaskDetails({ wid, projectId, taskId, onClose, onChanged }: Props & { taskId: string }) {
  const { canEdit, canManage, isAdmin } = useWorkspace();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const base = `/workspaces/${wid}/projects/${projectId}`;
  const taskUrl = `${base}/tasks/${taskId}`;
  const taskKey = ['ws', wid, 'task', taskId];

  const task = useQuery({ queryKey: taskKey, queryFn: () => get<Task>(taskUrl) });
  const members = useQuery({
    queryKey: ['ws', wid, 'project-members', projectId],
    queryFn: () => get<{ user: UserBrief }[]>(`${base}/members`),
  });
  const labels = useQuery({ queryKey: ['ws', wid, 'labels'], queryFn: () => get<Label[]>(`/workspaces/${wid}/labels`) });
  const comments = useQuery({ queryKey: ['task', taskId, 'comments'], queryFn: () => get<Comment[]>(`${taskUrl}/comments`) });
  const attachments = useQuery({ queryKey: ['task', taskId, 'attachments'], queryFn: () => get<Attachment[]>(`${taskUrl}/attachments`) });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: '', color: '#2f6fdb' });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task.data) {
      setTitle(task.data.title);
      setDescription(task.data.description ?? '');
    }
    // resync when the server copy changes (own save or a teammate's edit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.data?.id, task.data?.updatedAt]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: taskKey });
    onChanged();
  };
  const onError = (e: unknown) => toast.error(errMsg(e));

  const save = useMutation({ mutationFn: (body: Record<string, unknown>) => patch(taskUrl, body), onSuccess: refresh, onError });
  const moveTo = useMutation({
    mutationFn: (status: TaskStatus) => post(`${taskUrl}/move`, { status, afterTaskId: null }),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: () => del(taskUrl),
    onSuccess: () => {
      onChanged();
      onClose();
      toast.success('Task deleted');
    },
    onError,
  });
  const addComment = useMutation({
    mutationFn: () => post(`${taskUrl}/comments`, { body: commentText }),
    onSuccess: () => {
      setCommentText('');
      void qc.invalidateQueries({ queryKey: ['task', taskId, 'comments'] });
      refresh();
    },
    onError,
  });
  const deleteComment = useMutation({
    mutationFn: (id: string) => del(`${taskUrl}/comments/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId, 'comments'] });
      refresh();
    },
    onError,
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`${taskUrl}/attachments`, form);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['task', taskId, 'attachments'] }),
    onError,
  });
  const deleteAttachment = useMutation({
    mutationFn: (id: string) => del(`${taskUrl}/attachments/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['task', taskId, 'attachments'] }),
    onError,
  });
  const createLabel = useMutation({
    mutationFn: () => post(`/workspaces/${wid}/labels`, newLabel),
    onSuccess: () => {
      setNewLabel({ name: '', color: newLabel.color });
      void qc.invalidateQueries({ queryKey: ['ws', wid, 'labels'] });
    },
    onError,
  });

  function onPickFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_BYTES) toast.error('Files can be up to 10 MB.');
    else upload.mutate(file);
    if (fileInput.current) fileInput.current.value = '';
  }

  if (task.isLoading) return <Spinner label="Loading task" />;
  if (task.isError || !task.data) {
    return (
      <div className="space-y-3 p-5">
        <ErrorNote>{errMsg(task.error)}</ErrorNote>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }
  const t = task.data;
  const activeLabelIds = t.labels.map((l) => l.id);
  const toggleLabel = (id: string) =>
    save.mutate({ labelIds: activeLabelIds.includes(id) ? activeLabelIds.filter((x) => x !== id) : [...activeLabelIds, id] });

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <Input
          aria-label="Task title"
          className="flex-1 text-lg font-semibold"
          maxLength={200}
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== t.title && save.mutate({ title })}
        />
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          {(id) => (
            <Select id={id} value={t.status} disabled={!canEdit} onChange={(e) => moveTo.mutate(e.target.value as TaskStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} value={t.priority} disabled={!canEdit} onChange={(e) => save.mutate({ priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Assignee">
          {(id) => (
            <Select id={id} value={t.assigneeId ?? ''} disabled={!canEdit} onChange={(e) => save.mutate({ assigneeId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {members.data?.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Due date">
          {(id) => (
            <Input id={id} type="date" value={toDateInput(t.dueDate)} disabled={!canEdit} onChange={(e) => save.mutate({ dueDate: e.target.value || null })} />
          )}
        </Field>
      </div>

      <Section title="Labels">
        <div className="flex flex-wrap gap-1.5">
          {labels.data?.map((l) => {
            const on = activeLabelIds.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                disabled={!canEdit}
                onClick={() => toggleLabel(l.id)}
                className="rounded border px-2 py-0.5 text-xs disabled:cursor-not-allowed"
                style={on ? { background: l.color, borderColor: l.color, color: '#fff' } : { borderColor: l.color, color: '#1B2236' }}
              >
                {l.name}
              </button>
            );
          })}
          {labels.data?.length === 0 && <p className="text-sm text-muted">No labels in this workspace yet.</p>}
        </div>
        {canManage && (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (newLabel.name.trim()) createLabel.mutate();
            }}
          >
            <Input aria-label="New label name" placeholder="New label" maxLength={40} className="w-40" value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} />
            <input aria-label="Label colour" type="color" value={newLabel.color} onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })} className="h-9 w-10 rounded border border-line bg-white p-1" />
            <Button type="submit" loading={createLabel.isPending}>Add label</Button>
          </form>
        )}
      </Section>

      <Section title="Description">
        <Textarea
          aria-label="Description"
          maxLength={10000}
          value={description}
          disabled={!canEdit}
          placeholder={canEdit ? 'Add details, acceptance criteria or links' : 'No description'}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (t.description ?? '') && save.mutate({ description })}
        />
      </Section>

      <Section title="Attachments">
        <ul className="divide-y divide-line">
          {attachments.data?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <a href={a.downloadUrl} className="block truncate font-medium underline" download={a.fileName}>{a.fileName}</a>
                <span className="text-xs text-muted">
                  {fmtBytes(a.sizeBytes)} · {a.uploadedBy?.name ?? 'Deleted user'} · {fmtDateTime(a.createdAt)}
                </span>
              </span>
              {canEdit && (
                <Button variant="ghost" className="h-8" onClick={() => deleteAttachment.mutate(a.id)}>Remove</Button>
              )}
            </li>
          ))}
        </ul>
        {attachments.data?.length === 0 && <p className="text-sm text-muted">No files attached.</p>}
        {canEdit && (
          <div className="mt-3">
            <input ref={fileInput} type="file" accept={ACCEPT} aria-label="Attach a file" disabled={upload.isPending} onChange={(e) => onPickFile(e.target.files?.[0])} className="text-sm" />
            <p className="mt-1 text-xs text-muted">Images, PDF, text, CSV, JSON or ZIP, up to 10 MB.</p>
          </div>
        )}
      </Section>

      <Section title={`Comments${comments.data ? ` (${comments.data.length})` : ''}`}>
        <ul className="space-y-3">
          {comments.data?.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar name={c.author.name} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{c.author.name}</span>
                  <span className="ml-2 text-xs text-muted">{fmtDateTime(c.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              {(c.author.id === me.id || isAdmin) && (
                <Button variant="ghost" className="h-7" onClick={() => deleteComment.mutate(c.id)}>Delete</Button>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (commentText.trim()) addComment.mutate();
            }}
          >
            <Textarea aria-label="Write a comment" placeholder="Write a comment" maxLength={5000} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
            <Button type="submit" variant="primary" loading={addComment.isPending}>Add comment</Button>
          </form>
        )}
      </Section>

      {canEdit && (
        <Section title="Delete task">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Delete permanently</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep task</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmDelete(true)}>Delete task</Button>
          )}
        </Section>
      )}
    </div>
  );
}
