import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { WorkspaceId } from '../common/decorators/params';
import { MinWorkspaceRole } from '../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { CreateLabelDto } from './dto/tasks.dto';
import { LabelsService } from './labels.service';

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/labels')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.labels.list(workspaceId);
  }

  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @Post()
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateLabelDto) {
    return this.labels.create(workspaceId, dto);
  }

  @MinWorkspaceRole(WorkspaceRole.PROJECT_MANAGER)
  @HttpCode(204)
  @Delete(':labelId')
  remove(@WorkspaceId() workspaceId: string, @Param('labelId', ParseUUIDPipe) labelId: string) {
    return this.labels.remove(workspaceId, labelId);
  }
}
