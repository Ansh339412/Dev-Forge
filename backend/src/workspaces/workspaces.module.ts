import { Module } from '@nestjs/common';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { WorkspaceDetailController } from './workspace-detail.controller';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController, WorkspaceDetailController, InvitationsController],
  providers: [WorkspacesService, InvitationsService, WorkspaceRolesGuard],
  exports: [WorkspacesService, WorkspaceRolesGuard],
})
export class WorkspacesModule {}
