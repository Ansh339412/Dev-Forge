import { WorkspaceRole } from '@prisma/client';

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 1,
  [WorkspaceRole.DEVELOPER]: 2,
  [WorkspaceRole.PROJECT_MANAGER]: 3,
  [WorkspaceRole.WORKSPACE_ADMIN]: 4,
};

export const atLeast = (role: WorkspaceRole, min: WorkspaceRole): boolean =>
  ROLE_RANK[role] >= ROLE_RANK[min];
