import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceId } from '../common/decorators/params';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { DashboardQuery } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@WorkspaceId() workspaceId: string, @Query() q: DashboardQuery) {
    return this.analytics.dashboard(workspaceId, q.days ?? 14);
  }

  @Get('my-tasks')
  myTasks(@WorkspaceId() workspaceId: string, @CurrentUser() user: AuthUser) {
    return this.analytics.myTasks(workspaceId, user.id);
  }
}
