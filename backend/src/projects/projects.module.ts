import { Module } from '@nestjs/common';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, WorkspaceRolesGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
