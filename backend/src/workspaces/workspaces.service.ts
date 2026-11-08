import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Events, FilesOrphanedEvent } from '../common/events';
import { attachmentKeys } from '../common/utils/attachment-keys';
import { generateToken } from '../common/utils/crypto.util';
import { slugify } from '../common/utils/slugify.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** The creator becomes the first (and initially only) workspace admin. */
  create(user: AuthUser, dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        name: dto.name.trim(),
        description: dto.description,
        slug: `${slugify(dto.name)}-${generateToken(3)}`,
        members: { create: { userId: user.id, role: WorkspaceRole.WORKSPACE_ADMIN } },
      },
    });
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async get(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { _count: { select: { members: true } } },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.get(workspaceId);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name?.trim(), description: dto.description },
    });
  }

  async remove(workspaceId: string) {
    await this.get(workspaceId);
    const keys = await attachmentKeys(this.prisma, { task: { project: { workspaceId } } });
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    if (keys.length) this.events.emit(Events.FilesOrphaned, { keys } satisfies FilesOrphanedEvent);
  }

  listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async changeRole(workspaceId: string, userId: string, role: WorkspaceRole) {
    const member = await this.findMember(workspaceId, userId);
    if (member.role === WorkspaceRole.WORKSPACE_ADMIN && role !== WorkspaceRole.WORKSPACE_ADMIN) {
      await this.assertAnotherAdminExists(workspaceId, userId);
    }
    return this.prisma.workspaceMember.update({ where: { id: member.id }, data: { role } });
  }

  async removeMember(workspaceId: string, userId: string) {
    const member = await this.findMember(workspaceId, userId);
    if (member.role === WorkspaceRole.WORKSPACE_ADMIN) {
      await this.assertAnotherAdminExists(workspaceId, userId);
    }
    await this.prisma.workspaceMember.delete({ where: { id: member.id } });
  }

  private async findMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  /** A workspace must never be left without an admin. */
  private async assertAnotherAdminExists(workspaceId: string, excludingUserId: string) {
    const others = await this.prisma.workspaceMember.count({
      where: { workspaceId, role: WorkspaceRole.WORKSPACE_ADMIN, userId: { not: excludingUserId } },
    });
    if (others === 0) {
      throw new BadRequestException('Workspace must keep at least one admin. Promote someone first.');
    }
  }
}
