import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';
import { WORKSPACE_ROLE_KEY } from '../decorators/workspace-role.decorator';
import { atLeast } from '../utils/roles.util';

/**
 * Enforces workspace-scoped RBAC on routes containing :workspaceId.
 * Fails closed: a route without :workspaceId is rejected.
 * Non-members get 404 so workspace existence is not leaked.
 */
@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<WorkspaceRole | undefined>(WORKSPACE_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? WorkspaceRole.VIEWER;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const workspaceId = req.params?.workspaceId as string | undefined;
    if (!user || !workspaceId) throw new ForbiddenException();

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      req.workspaceRole = WorkspaceRole.WORKSPACE_ADMIN;
      return true;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!membership) throw new NotFoundException('Workspace not found');
    if (!atLeast(membership.role, required)) {
      throw new ForbiddenException('Insufficient workspace role');
    }
    req.workspaceRole = membership.role;
    return true;
  }
}
