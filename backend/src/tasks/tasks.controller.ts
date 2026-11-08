import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentRole, ProjectId, TaskId, WorkspaceId } from '../common/decorators/params';
import { MinWorkspaceRole } from '../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { CreateTaskDto, ListTasksQuery, MoveTaskDto, UpdateTaskDto } from './dto/tasks.dto';
import { TasksService } from './tasks.service';

const DEV = WorkspaceRole.DEVELOPER;

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @MinWorkspaceRole(DEV)
  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(workspaceId, projectId, user, role, dto);
  }

  @Get()
  list(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string, @Query() query: ListTasksQuery) {
    return this.tasks.list(workspaceId, projectId, query);
  }

  // Declared before :taskId so "board" is not treated as an id.
  @Get('board')
  board(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string) {
    return this.tasks.board(workspaceId, projectId);
  }

  @Get(':taskId')
  get(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string, @TaskId() taskId: string) {
    return this.tasks.get(workspaceId, projectId, taskId);
  }

  @MinWorkspaceRole(DEV)
  @Patch(':taskId')
  update(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(workspaceId, projectId, taskId, user, role, dto);
  }

  @MinWorkspaceRole(DEV)
  @HttpCode(200)
  @Post(':taskId/move')
  move(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasks.move(workspaceId, projectId, taskId, user, role, dto);
  }

  @MinWorkspaceRole(DEV)
  @HttpCode(204)
  @Delete(':taskId')
  remove(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
  ) {
    return this.tasks.remove(workspaceId, projectId, taskId, user, role);
  }
}
