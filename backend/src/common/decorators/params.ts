import { createParamDecorator, ExecutionContext, Param, ParseUUIDPipe } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';

export const WorkspaceId = () => Param('workspaceId', ParseUUIDPipe);
export const ProjectId = () => Param('projectId', ParseUUIDPipe);
export const TaskId = () => Param('taskId', ParseUUIDPipe);

/** The caller's effective role in the current workspace (set by WorkspaceRolesGuard; Super Admin = admin). */
export const CurrentRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceRole =>
    ctx.switchToHttp().getRequest().workspaceRole,
);
