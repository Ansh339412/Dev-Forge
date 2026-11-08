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
import { MinWorkspaceRole } from '../common/decorators/workspace-role.decorator';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import {
  CreateInvitationDto,
  UpdateMemberRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspaces.dto';
import { InvitationsService } from './invitations.service';
import { WorkspacesService } from './workspaces.service';

const ADMIN = WorkspaceRole.WORKSPACE_ADMIN;

/** Everything under /workspaces/:workspaceId. The guard checks membership and role on every route. */
@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(WorkspaceRolesGuard)
@Controller('workspaces/:workspaceId')
export class WorkspaceDetailController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get()
  get(@Param('workspaceId', ParseUUIDPipe) id: string) {
    return this.workspaces.get(id);
  }

  @MinWorkspaceRole(ADMIN)
  @Patch()
  update(@Param('workspaceId', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaces.update(id, dto);
  }

  @MinWorkspaceRole(ADMIN)
  @HttpCode(204)
  @Delete()
  remove(@Param('workspaceId', ParseUUIDPipe) id: string) {
    return this.workspaces.remove(id);
  }

  // ---- members ----

  @Get('members')
  members(@Param('workspaceId', ParseUUIDPipe) id: string) {
    return this.workspaces.listMembers(id);
  }

  // Declared before members/:userId so "me" is not parsed as a user id.
  @HttpCode(204)
  @Delete('members/me')
  leave(@Param('workspaceId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.workspaces.removeMember(id, user.id);
  }

  @MinWorkspaceRole(ADMIN)
  @Patch('members/:userId')
  changeRole(
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaces.changeRole(id, userId, dto.role);
  }

  @MinWorkspaceRole(ADMIN)
  @HttpCode(204)
  @Delete('members/:userId')
  removeMember(
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.workspaces.removeMember(id, userId);
  }

  // ---- invitations ----

  @MinWorkspaceRole(ADMIN)
  @Post('invitations')
  invite(
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(id, user, dto);
  }

  @MinWorkspaceRole(ADMIN)
  @Get('invitations')
  pendingInvitations(@Param('workspaceId', ParseUUIDPipe) id: string) {
    return this.invitations.listPending(id);
  }

  @MinWorkspaceRole(ADMIN)
  @HttpCode(204)
  @Delete('invitations/:invitationId')
  revokeInvitation(
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitations.revoke(id, invitationId);
  }
}
