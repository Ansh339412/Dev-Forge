import type { Priority, ProjectStatus, TaskStatus, WorkspaceRole } from './types';

export const STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'];

/** Columns run from raw to tempered: the colour tracks how far the work has come. */
export const STATUS_META: Record<TaskStatus, { label: string; bar: string; dot: string }> = {
  BACKLOG: { label: 'Backlog', bar: 'bg-heat-ore', dot: 'bg-heat-ore' },
  TODO: { label: 'To do', bar: 'bg-heat-warm', dot: 'bg-heat-warm' },
  IN_PROGRESS: { label: 'In progress', bar: 'bg-heat-ember', dot: 'bg-heat-ember' },
  IN_REVIEW: { label: 'In review', bar: 'bg-heat-quench', dot: 'bg-heat-quench' },
  COMPLETED: { label: 'Completed', bar: 'bg-heat-temper', dot: 'bg-heat-temper' },
};

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const PRIORITY_META: Record<Priority, { label: string; text: string }> = {
  LOW: { label: 'Low', text: 'text-muted' },
  MEDIUM: { label: 'Medium', text: 'text-muted' },
  HIGH: { label: 'High', text: 'text-heat-warm' },
  URGENT: { label: 'Urgent', text: 'text-danger' },
};

export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const ROLES: WorkspaceRole[] = ['WORKSPACE_ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'VIEWER'];
export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  WORKSPACE_ADMIN: 'Workspace admin',
  PROJECT_MANAGER: 'Project manager',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
};
const RANK: Record<WorkspaceRole, number> = { VIEWER: 1, DEVELOPER: 2, PROJECT_MANAGER: 3, WORKSPACE_ADMIN: 4 };
export const roleAtLeast = (role: WorkspaceRole | undefined, min: WorkspaceRole) =>
  !!role && RANK[role] >= RANK[min];
