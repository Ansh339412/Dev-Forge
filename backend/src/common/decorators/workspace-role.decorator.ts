import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';

export const WORKSPACE_ROLE_KEY = 'workspaceMinRole';
/** Minimum workspace role required. Defaults to VIEWER (any member) when omitted. */
export const MinWorkspaceRole = (role: WorkspaceRole) => SetMetadata(WORKSPACE_ROLE_KEY, role);
