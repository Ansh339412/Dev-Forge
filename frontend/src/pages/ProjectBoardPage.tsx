import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ProjectTabs } from '../components/ProjectTabs';
import { Avatar, ErrorNote, Input, ProgressBar, Select, Spinner } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { get, patch, post } from '../lib/api';
import { applyMove } from '../lib/board';
import { errMsg } from '../lib/errors';
import { fmtDate, isOverdue } from '../lib/format';
import { PRIORITY_META, PROJECT_STATUS_LABEL, PROJECT_STATUSES, STATUS_META, STATUSES } from '../lib/meta';
import { useSocket } from '../lib/realtime';
import type { Board, Project, ProjectStatus, Task, TaskStatus } from '../lib/types';
import { toast } from '../stores/toast';
import TaskDrawer from './TaskDrawer';

function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const overdue = isOverdue(task.dueDate, task.status === 'COMPLETED');
  const urgent = task.priority === 'HIGH' || task.priority === 'URGENT';
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && onOpen()}
      className="cursor-pointer rounded border border-line bg-white p-2.5 text-sm hover:border-ink/30"
    >
      <p className="font-medium leading-snug">{task.title}</p>
      {task.labels.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span key={l.id} className="rounded px-1.5 py-0.5 text-xs text-white" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-2">
          {urgent && <span className={`font-semibold ${PRIORITY_META[task.priority].text}`}>{PRIORITY_META[task.priority].label}</span>}
          {task.dueDate && (
            <span className={overdue ? 'font-semibold text-danger' : ''} title={overdue ? 'Overdue' : 'Due date'}>
              {overdue ? 'Overdue ' : 'Due '}
              {fmtDate(task.dueDate)}
            </span>
          )}
          {task._count.comments > 0 && <span>{task._count.comments} comments</span>}
        </span>
        {task.assignee && <Avatar name={task.assignee.name} size={22} />}
      </div>
    </div>
  );
}

function QuickAdd({ base, status, onDone }: { base: string; status: TaskStatus; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const create = useMutation({
    mutationFn: () => post(`${base}/tasks`, { title, status }),
    onSuccess: () => {
      setTitle('');
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded px-2 py-1.5 text-left text-sm text-muted hover:bg-white hover:text-ink">
        Add task
      </button>
    );
  }
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (title.trim()) create.mutate();
      }}
    >
      <Input
        autoFocus
        aria-label={`New ${STATUS_META[status].label} task title`}
        placeholder="Task title, then Enter"
        maxLength={200}
        value={title}
        disabled={create.isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        onBlur={() => !title && setOpen(false)}
      />
    </form>
  );
}

export default function ProjectBoardPage() {
  const { workspace, canEdit, canManage } = useWorkspace();
  const { projectId = '' } = useParams();
  const wid = workspace.id;
  const base = `/workspaces/${wid}/projects/${projectId}`;
  const projectKey = ['ws', wid, 'project', projectId];
  const boardKey = ['ws', wid, 'board', projectId];
  const qc = useQueryClient();
  const socket = useSocket();
  const [params, setParams] = useSearchParams();
  const openTaskId = params.get('task');
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');

  const project = useQuery({ queryKey: projectKey, queryFn: () => get<Project>(base) });
  const board = useQuery({ queryKey: boardKey, queryFn: () => get<Board>(`${base}/tasks/board`) });
  const members = useQuery({
    queryKey: ['ws', wid, 'project-members', projectId],
    queryFn: () => get<{ user: { id: string; name: string } }[]>(`${base}/members`),
  });

  // Live updates: join this project's room and refresh when anyone changes a task.
  useEffect(() => {
    if (!socket) return;
    const onChange = () => {
      void qc.invalidateQueries({ queryKey: boardKey });
      void qc.invalidateQueries({ queryKey: ['ws', wid, 'task'] });
      void qc.invalidateQueries({ queryKey: projectKey });
    };
    socket.emit('project.join', { projectId });
    socket.on('task.changed', onChange);
    return () => {
      socket.off('task.changed', onChange);
      socket.emit('project.leave', { projectId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, projectId, wid]);

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: boardKey });
    void qc.invalidateQueries({ queryKey: projectKey });
  };

  const move = useMutation({
    mutationFn: (v: { taskId: string; status: TaskStatus; afterTaskId: string | null }) =>
      post(`${base}/tasks/${v.taskId}/move`, { status: v.status, afterTaskId: v.afterTaskId }),
    onError: (e) => toast.error(errMsg(e)),
    onSettled: refreshAll, // on failure this also rolls the optimistic move back
  });

  const setStatus = useMutation({
    mutationFn: (status: ProjectStatus) => patch(base, { status }),
    onSuccess: refreshAll,
    onError: (e) => toast.error(errMsg(e)),
  });

  const filtering = !!assignee || !!search.trim();
  const visible = (tasks: Task[]) =>
    tasks.filter(
      (t) =>
        (!assignee || t.assigneeId === assignee) &&
        (!search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase())),
    );

  function onDragEnd(r: DropResult) {
    if (!r.destination || !board.data) return;
    const from = { status: r.source.droppableId as TaskStatus, index: r.source.index };
    const to = { status: r.destination.droppableId as TaskStatus, index: r.destination.index };
    if (from.status === to.status && from.index === to.index) return;

    const res = applyMove(board.data, from, to);
    res.columns[to.status] = res.columns[to.status].map((t) => (t.id === r.draggableId ? { ...t, status: to.status } : t));
    qc.setQueryData(boardKey, res.columns); // optimistic
    move.mutate({ taskId: r.draggableId, status: to.status, afterTaskId: res.afterTaskId });
  }

  if (project.isLoading || board.isLoading) return <Spinner label="Loading project" />;
  if (project.isError || !project.data) return <div className="p-6"><ErrorNote>{errMsg(project.error)}</ErrorNote></div>;
  const p = project.data;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-white px-6 py-3">
        <p className="text-sm text-muted"><Link to={`/w/${wid}/projects`} className="underline">Projects</Link></p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{p.name}</h1>
            <p className="text-sm text-muted">
              Managed by {p.manager.name}
              {p.deadline && ` · Due ${fmtDate(p.deadline)}`}
            </p>
          </div>
          <div className="flex w-64 items-center gap-3">
            <div className="flex-1">
              <ProgressBar percent={p.completionPercent} label="Project completion" />
              <p className="mt-1 text-xs text-muted">{p.completionPercent}% complete</p>
            </div>
            {canManage ? (
              <Select aria-label="Project status" className="w-32" value={p.status} onChange={(e) => setStatus.mutate(e.target.value as ProjectStatus)}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
              </Select>
            ) : (
              <span className="text-sm">{PROJECT_STATUS_LABEL[p.status]}</span>
            )}
          </div>
        </div>
        <div className="mt-2">
          <ProjectTabs />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input aria-label="Search tasks" placeholder="Search tasks" className="w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Filter by assignee" className="w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">All assignees</option>
            {members.data?.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
          </Select>
          {filtering && <span className="text-sm text-muted">Clear the filters to drag cards.</span>}
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
          {STATUSES.map((status) => {
            const tasks = board.data?.[status] ?? [];
            const shown = visible(tasks);
            return (
              <section key={status} aria-label={STATUS_META[status].label} className="flex w-72 shrink-0 flex-col">
                <div className={clsx('h-1 rounded-full', STATUS_META[status].bar)} />
                <h2 className="flex items-center justify-between px-1 py-2 text-sm font-semibold">
                  {STATUS_META[status].label}
                  <span className="font-normal text-muted">{filtering ? `${shown.length} of ${tasks.length}` : tasks.length}</span>
                </h2>
                <Droppable droppableId={status}>
                  {(drop, snap) => (
                    <div
                      ref={drop.innerRef}
                      {...drop.droppableProps}
                      className={clsx('min-h-[3rem] flex-1 space-y-2 overflow-y-auto rounded p-1', snap.isDraggingOver && 'bg-ink/5')}
                    >
                      {shown.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canEdit || filtering}>
                          {(drag) => (
                            <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                              <TaskCard task={task} onOpen={() => setParams({ task: task.id })} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                      {canEdit && <QuickAdd base={base} status={status} onDone={refreshAll} />}
                    </div>
                  )}
                </Droppable>
              </section>
            );
          })}
        </div>
      </DragDropContext>

      <TaskDrawer
        wid={wid}
        projectId={projectId}
        taskId={openTaskId}
        onClose={() => setParams({})}
        onChanged={refreshAll}
      />
    </div>
  );
}
