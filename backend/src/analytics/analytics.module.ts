import { Module } from '@nestjs/common';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, WorkspaceRolesGuard],
})
export class AnalyticsModule {}
