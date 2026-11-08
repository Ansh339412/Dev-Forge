import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Project, TaskStatus, WorkspaceRole } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Events, FilesOrphanedEvent, ProjectUpdatedEvent } from '../common/events';
import { attachmentKeys } from '../common/utils/attachment-keys';
import { atLeast } from '../common/utils/roles.util';
import { USER_BRIEF } from '../common/utils/selects';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';

const PM = WorkspaceRole.PROJECT_MANAGER;
const ADMIN = WorkspaceRole.WORKSPACE_ADMIN;

const emptyCounts = (): Record<TaskStatus, number> => ({
  [TaskStatus.BACKLOG]: 0,
  [TaskStatus.TODO]: 0,
  [TaskStatus.IN_PROGRESS]: 0,
  [TaskStatus.IN_REVIEW]: 0,
  [TaskStatus.COMPLETED]: 0,
});

const INCLUDE = {
  manager: { select: USER_BRIEF },
  _count: { select: { members: true, tasks: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  // ---------- projects ----------

  async create(workspaceId: string, user: AuthUser, dto: CreateProjectDto) {
    const managerId = dto.managerId ?? user.id;
    await this.assertWorkspaceRole(workspaceId, managerId, PM, 'Project manager');

    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        managerId,
        createdById: user.id,
        members: { create: { userId: managerId } },
      },
      include: INCLUDE,
    });
    await this.activity.log({
      workspaceId,
      projectId: project.id,
      actorId: user.id,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name },
    });
    return this.withStats([project]).then((r) => r[0]);
  }

  async list(workspaceId: string, status?: Project['status']) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, status },
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return this.withStats(projects);
  }

  async get(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: INCLUDE,
    });
    if (!project) throw new NotFoundException('Project not found');
    return (await this.withStats([project]))[0];
  }

  async update(
    workspaceId: string,
    projectId: string,
    user: AuthUser,
    role: WorkspaceRole,
    dto: UpdateProjectDto,
  ) {
    const project = await this.requireProject(workspaceId, projectId);
    this.assertCanManage(project, user, role);

    const changingManager = dto.managerId !== undefined && dto.managerId !== project.managerId;
    if (changingManager) {
      if (role !== ADMIN) throw new ForbiddenException('Only a workspace admin can reassign the manager');
      await this.assertWorkspaceRole(workspaceId, dto.managerId!, PM, 'Project manager');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (changingManager) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: dto.managerId! } },
          update: {},
          create: { projectId, userId: dto.managerId! },
        });
      }
      return tx.project.update({
        where: { id: projectId },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          managerId: dto.managerId,
          deadline: dto.deadline === undefined ? undefined : dto.deadline === null ? null : new Date(dto.deadline),
        },
        include: INCLUDE,
      });
    });

    const changes = Object.entries(dto)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'project.updated',
      entityType: 'project',
      entityId: projectId,
      metadata: { changes },
    });
    this.events.emit(Events.ProjectUpdated, {
      workspaceId,
      projectId,
      actorId: user.id,
      changes,
    } satisfies ProjectUpdatedEvent);
    return (await this.withStats([updated]))[0];
  }

  async remove(workspaceId: string, projectId: string) {
    await this.requireProject(workspaceId, projectId);
    const keys = await attachmentKeys(this.prisma, { task: { projectId } });
    await this.prisma.project.delete({ where: { id: projectId } });
    if (keys.length) this.events.emit(Events.FilesOrphaned, { keys } satisfies FilesOrphanedEvent);
  }

  // ---------- members ----------

  listMembers(workspaceId: string, projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId, project: { workspaceId } },
      select: { addedAt: true, user: { select: USER_BRIEF } },
      orderBy: { addedAt: 'asc' },
    });
  }

  async addMember(
    workspaceId: string,
    projectId: string,
    user: AuthUser,
    role: WorkspaceRole,
    userId: string,
  ) {
    const project = await this.requireProject(workspaceId, projectId);
    this.assertCanManage(project, user, role);
    await this.assertWorkspaceRole(workspaceId, userId, WorkspaceRole.DEVELOPER, 'Project member');

    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { projectId, userId },
    });
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'member.added',
      entityType: 'member',
      entityId: userId,
    });
    return member;
  }

  async removeMember(
    workspaceId: string,
    projectId: string,
    user: AuthUser,
    role: WorkspaceRole,
    userId: string,
  ) {
    const project = await this.requireProject(workspaceId, projectId);
    this.assertCanManage(project, user, role);
    if (project.managerId === userId) {
      throw new BadRequestException('Reassign the project manager before removing them');
    }
    await this.prisma.$transaction([
      this.prisma.projectMember.deleteMany({ where: { projectId, userId } }),
      this.prisma.task.updateMany({ where: { projectId, assigneeId: userId }, data: { assigneeId: null } }),
    ]);
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'member.removed',
      entityType: 'member',
      entityId: userId,
    });
  }

  // ---------- shared with the tasks module ----------

  async requireProject(workspaceId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  /** Admins/PMs may work on any project; Developers only on projects they belong to. */
  async assertCanWork(project: Project, user: AuthUser, role: WorkspaceRole) {
    if (atLeast(role, PM)) return;
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this project');
  }

  async assertProjectMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new BadRequestException('Assignee must be a member of the project');
  }

  // ---------- internals ----------

  assertCanManage(project: Project, user: AuthUser, role: WorkspaceRole) {
    const allowed = role === ADMIN || (atLeast(role, PM) && project.managerId === user.id);
    if (!allowed) throw new ForbiddenException('Only the project manager or a workspace admin can do this');
  }

  private async assertWorkspaceRole(
    workspaceId: string,
    userId: string,
    min: WorkspaceRole,
    label: string,
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member || !atLeast(member.role, min)) {
      throw new BadRequestException(`${label} must be a workspace member with at least the ${min} role`);
    }
  }

  /** Adds per-status task counts and completion % (real data, used by the dashboard later). */
  private async withStats<T extends { id: string }>(projects: T[]) {
    const rows = projects.length
      ? await this.prisma.task.groupBy({
          by: ['projectId', 'status'],
          where: { projectId: { in: projects.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [];
    const stats = new Map<string, Record<TaskStatus, number>>();
    for (const row of rows) {
      const counts = stats.get(row.projectId) ?? emptyCounts();
      counts[row.status] = row._count._all;
      stats.set(row.projectId, counts);
    }
    return projects.map((p) => {
      const taskCounts = stats.get(p.id) ?? emptyCounts();
      const total = Object.values(taskCounts).reduce((a, b) => a + b, 0);
      const completionPercent = total ? Math.round((taskCounts.COMPLETED / total) * 100) : 0;
      return { ...p, taskCounts, completionPercent };
    });
  }
}
