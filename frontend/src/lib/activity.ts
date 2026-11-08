import { STATUS_META } from './meta';
import type { Activity, TaskStatus } from './types';

const statusLabel = (s: unknown) => STATUS_META[s as TaskStatus]?.label ?? String(s);
const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');

/** Turns a stored activity entry into a sentence (the actor's name is shown separately). */
export function describe(a: Pick<Activity, 'action' | 'metadata'>): string {
  const m = a.metadata ?? {};
  switch (a.action) {
    case 'project.created': return 'created the project';
    case 'project.updated': return `updated the project (${list(m.changes)})`;
    case 'task.created': return `created task "${m.title}"`;
    case 'task.updated': return `edited a task (${list(m.changes)})`;
    case 'task.moved': return `moved "${m.title}" from ${statusLabel(m.from)} to ${statusLabel(m.to)}`;
    case 'task.deleted': return `deleted task "${m.title}"`;
    case 'comment.created': return `commented on "${m.taskTitle}"`;
    case 'attachment.added': return `attached ${m.fileName}`;
    case 'attachment.removed': return `removed attachment ${m.fileName}`;
    case 'member.added': return 'added a team member';
    case 'member.removed': return 'removed a team member';
    case 'integration.github.connected': return `connected ${m.repository}`;
    default: return a.action;
  }
}
