import { Module } from '@nestjs/common';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { ProjectsModule } from '../projects/projects.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProjectsModule],
  controllers: [TasksController, CommentsController, LabelsController],
  providers: [TasksService, CommentsService, LabelsService, WorkspaceRolesGuard],
})
export class TasksModule {}
