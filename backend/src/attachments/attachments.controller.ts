import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentRole, ProjectId, TaskId, WorkspaceId } from '../common/decorators/params';
import { MinWorkspaceRole } from '../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { AttachmentsService, MAX_ATTACHMENT_BYTES } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string, @ProjectId() projectId: string, @TaskId() taskId: string) {
    return this.attachments.list(workspaceId, projectId, taskId);
  }

  @MinWorkspaceRole(WorkspaceRole.DEVELOPER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } }))
  @Post()
  upload(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.attachments.upload(workspaceId, projectId, taskId, user, role, file);
  }

  @MinWorkspaceRole(WorkspaceRole.DEVELOPER)
  @HttpCode(204)
  @Delete(':attachmentId')
  remove(
    @WorkspaceId() workspaceId: string,
    @ProjectId() projectId: string,
    @TaskId() taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthUser,
    @CurrentRole() role: WorkspaceRole,
  ) {
    return this.attachments.remove(workspaceId, projectId, taskId, attachmentId, user, role);
  }
}
