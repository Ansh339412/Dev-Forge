import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentRole, ProjectId, WorkspaceId } from '../../common/decorators/params';
import { MinWorkspaceRole } from '../../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard';
import { ConnectRepositoryDto, ListCommitsQuery } from './dto/github.dto';
import { GithubService } from './github.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/integrations/github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string) {
    return this.github.list(workspaceId, projectId);
  }

  // Finer check (project manager or admin) happens in the service.
  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @Post()
  connect(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: ConnectRepositoryDto,
  ) {
    return this.github.connect(workspaceId, projectId, user, role, dto.repository);
  }

  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @HttpCode(204)
  @Delete(':repoId')
  disconnect(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Param('repoId', ParseUUIDPipe) repoId: string,
  ) {
    return this.github.disconnect(workspaceId, projectId, user, role, repoId);
  }

  @Get(':repoId/commits')
  commits(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @Param('repoId', ParseUUIDPipe) repoId: string,
    @Query() q: ListCommitsQuery,
  ) {
    return this.github.commits(workspaceId, projectId, repoId, q.limit ?? 20);
  }
}
