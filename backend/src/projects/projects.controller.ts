import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentRole, ProjectId, WorkspaceId } from '../common/decorators/params';
import { MinWorkspaceRole } from '../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import {
  AddProjectMemberDto,
  CreateProjectDto,
  ListProjectsQuery,
  PageQuery,
  UpdateProjectDto,
} from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
  ) {}

  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @Post()
  create(@WorkspaceId() workspaceId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(workspaceId, user, dto);
  }

  @Get()
  list(@WorkspaceId() workspaceId: string, @Query() query: ListProjectsQuery) {
    return this.projects.list(workspaceId, query.status);
  }

  @Get(':projectId')
  get(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string) {
    return this.projects.get(workspaceId, projectId);
  }

  // Finer check (admin or this project's manager) happens in the service.
  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @Patch(':projectId')
  update(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(workspaceId, projectId, user, role, dto);
  }

  @MinWorkspaceRole(WorkspaceRole.WORKSPACE_ADMIN)
  @HttpCode(204)
  @Delete(':projectId')
  remove(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string) {
    return this.projects.remove(workspaceId, projectId);
  }

  @Get(':projectId/activity')
  async activityFeed(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @Query() query: PageQuery,
  ) {
    await this.projects.requireProject(workspaceId, projectId);
    return this.activity.listForProject(projectId, query.page ?? 1, query.limit ?? 30);
  }

  @Get(':projectId/members')
  members(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string) {
    return this.projects.listMembers(workspaceId, projectId);
  }

  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @Post(':projectId/members')
  addMember(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projects.addMember(workspaceId, projectId, user, role, dto.userId);
  }

  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @HttpCode(204)
  @Delete(':projectId/members/:userId')
  removeMember(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.projects.removeMember(workspaceId, projectId, user, role, userId);
  }
}
