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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentRole, ProjectId, TaskId, WorkspaceId } from '../common/decorators/params';
import { MinWorkspaceRole } from '../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { CommentsService } from './comments.service';
import { CommentDto } from './dto/tasks.dto';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string, @TaskId() taskId: string) {
    return this.comments.list(workspaceId, projectId, taskId);
  }

  @MinWorkspaceRole(WorkspaceRole.DEVELOPER)
  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @Body() dto: CommentDto,
  ) {
    return this.comments.create(workspaceId, projectId, taskId, user, role, dto.body);
  }

  @MinWorkspaceRole(WorkspaceRole.DEVELOPER)
  @Patch(':commentId')
  update(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CommentDto,
  ) {
    return this.comments.update(workspaceId, projectId, taskId, commentId, user, dto.body);
  }

  @MinWorkspaceRole(WorkspaceRole.DEVELOPER)
  @HttpCode(204)
  @Delete(':commentId')
  remove(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
  ) {
    return this.comments.remove(workspaceId, projectId, taskId, commentId, user, role);
  }
}
