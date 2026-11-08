import { Module } from '@nestjs/common';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { ProjectsModule } from '../projects/projects.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { StorageService } from './storage.service';

@Module({
  imports: [ProjectsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, StorageService, WorkspaceRolesGuard],
})
export class AttachmentsModule {}
