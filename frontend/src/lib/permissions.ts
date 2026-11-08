import { roleAtLeast } from './meta';
import type { WorkspaceRole } from './types';

/** Mirrors the backend rule: a workspace admin, or the project's own manager (who is at least a project manager). */
export const canEditProject = (project: { managerId: string }, userId: string, role: WorkspaceRole) =>
  role === 'WORKSPACE_ADMIN' || (roleAtLeast(role, 'PROJECT_MANAGER') && project.managerId === userId);
