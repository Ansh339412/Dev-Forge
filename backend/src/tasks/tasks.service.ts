import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TaskStatus, WorkspaceRole } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Events, FilesOrphanedEvent, TaskAssignedEvent, TaskChangedEvent } from '../common/events';
import { attachmentKeys } from '../common/utils/attachment-keys';
import { placeAfter, STEP } from '../common/utils/kanban-position.util';
import { atLeast } from '../common/utils/roles.util';
import { USER_BRIEF } from '../common/utils/selects';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto, ListTasksQuery, MoveTaskDto, UpdateTaskDto } from './dto/tasks.dto';

export const TASK_INCLUDE = {
  assignee: { select: USER_BRIEF },
  labels: { select: { label: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

const flatten = ({ labels, ...task }: TaskWithRelations) => ({
  ...task,
  labels: labels.map((l) => l.label),
});

const labelLinks = (ids?: string[]) =>
  ids?.length ? { create: [...new Set(ids)].map((labelId) => ({ labelId })) } : undefined;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    workspaceId: string,
    projectId: string,
    user: AuthUser,
    role: WorkspaceRole,
    dto: CreateTaskDto,
  ) {
    const project = await this.projects.requireProject(workspaceId, projectId);
    await this.projects.assertCanWork(project, user, role);
    if (dto.assigneeId) await this.projects.assertProjectMember(projectId, dto.assigneeId);
    await this.assertLabels(workspaceId, dto.labelIds);

    const status = dto.status ?? TaskStatus.BACKLOG;
    const last = await this.prisma.task.aggregate({
      where: { projectId, status },
      _max: { position: true },
    });

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title.trim(),
        description: dto.description,
        status,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId ?? undefined,
        createdById: user.id,
        position: (last._max.position ?? 0) + STEP,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : undefined,
        labels: labelLinks(dto.labelIds),
      },
      include: TASK_INCLUDE,
    });

    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'task.created',
      entityType: 'task',
      entityId: task.id,
      metadata: { title: task.title },
    });
    this.changed('created', workspaceId, projectId, task.id, user.id);
    this.notifyAssigned(workspaceId, task, user.id);
    return flatten(task);
  }

  async list(workspaceId: string, projectId: string, query: ListTasksQuery) {
    await this.projects.requireProject(workspaceId, projectId);
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        status: query.status,
        priority: query.priority,
        assigneeId: query.assigneeId,
      },
      include: TASK_INCLUDE,
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      take: query.limit ?? 200,
    });
    return tasks.map(flatten);
  }

  /** Kanban view: every column present, cards ordered top to bottom. */
  async board(workspaceId: string, projectId: string) {
    const tasks = await this.list(workspaceId, projectId, { limit: 500 });
    const columns = Object.fromEntries(
      Object.values(TaskStatus).map((s) => [s, [] as typeof tasks]),
    ) as Record<TaskStatus, typeof tasks>;
    for (const task of tasks) columns[task.status].push(task);
    return columns;
  }

  async get(workspaceId: string, projectId: string, taskId: string) {
    await this.projects.requireProject(workspaceId, projectId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');
    return flatten(task);
  }

  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: AuthUser,
    role: WorkspaceRole,
    dto: UpdateTaskDto,
  ) {
    const { task } = await this.loadForWrite(workspaceId, projectId, taskId, user, role);
    if (dto.assigneeId) await this.projects.assertProjectMember(projectId, dto.assigneeId);
    await this.assertLabels(workspaceId, dto.labelIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.labelIds !== undefined) await tx.taskLabel.deleteMany({ where: { taskId } });
      return tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title?.trim(),
          description: dto.description,
          priority: dto.priority,
          dueDate: dto.dueDate === undefined ? undefined : dto.dueDate === null ? null : new Date(dto.dueDate),
          assigneeId: dto.assigneeId,
          labels: labelLinks(dto.labelIds),
        },
        include: TASK_INCLUDE,
      });
    });

    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'task.updated',
      entityType: 'task',
      entityId: taskId,
      metadata: {
        changes: Object.entries(dto)
          .filter(([, v]) => v !== undefined)
          .map(([k]) => k),
      },
    });
    this.changed('updated', workspaceId, projectId, taskId, user.id);
    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      this.notifyAssigned(workspaceId, updated, user.id);
    }
    return flatten(updated);
  }

  /** Drag-and-drop: change column and/or position in one write. */
  async move(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: AuthUser,
    role: WorkspaceRole,
    dto: MoveTaskDto,
  ) {
    const { task } = await this.loadForWrite(workspaceId, projectId, taskId, user, role);
    if (dto.afterTaskId === taskId) throw new BadRequestException('A task cannot be placed after itself');

    const updated = await this.prisma.$transaction(async (tx) => {
      const column = await tx.task.findMany({
        where: { projectId, status: dto.status, id: { not: taskId } },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      const placement = placeAfter(column, dto.afterTaskId);
      if (!placement) throw new BadRequestException('afterTaskId is not in the target column');

      for (const t of placement.rebalanced ?? []) {
        await tx.task.update({ where: { id: t.id }, data: { position: t.position } });
      }
      return tx.task.update({
        where: { id: taskId },
        data: {
          status: dto.status,
          position: placement.position,
          completedAt: dto.status === TaskStatus.COMPLETED ? (task.completedAt ?? new Date()) : null,
        },
        include: TASK_INCLUDE,
      });
    });

    if (task.status !== dto.status) {
      await this.activity.log({
        workspaceId,
        projectId,
        actorId: user.id,
        action: 'task.moved',
        entityType: 'task',
        entityId: taskId,
        metadata: { title: task.title, from: task.status, to: dto.status },
      });
    }
    this.changed('moved', workspaceId, projectId, taskId, user.id);
    return flatten(updated);
  }

  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: AuthUser,
    role: WorkspaceRole,
  ) {
    const { task } = await this.loadForWrite(workspaceId, projectId, taskId, user, role);
    if (!atLeast(role, WorkspaceRole.PROJECT_MANAGER) && task.createdById !== user.id) {
      throw new ForbiddenException('Only the creator or a project manager can delete this task');
    }
    const keys = await attachmentKeys(this.prisma, { taskId });
    await this.prisma.task.delete({ where: { id: taskId } });
    if (keys.length) this.events.emit(Events.FilesOrphaned, { keys } satisfies FilesOrphanedEvent);
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'task.deleted',
      entityType: 'task',
      entityId: taskId,
      metadata: { title: task.title },
    });
    this.changed('deleted', workspaceId, projectId, taskId, user.id);
  }

  // ---------- internals ----------

  private async loadForWrite(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: AuthUser,
    role: WorkspaceRole,
  ) {
    const project = await this.projects.requireProject(workspaceId, projectId);
    await this.projects.assertCanWork(project, user, role);
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Task not found');
    return { project, task };
  }

  private async assertLabels(workspaceId: string, labelIds?: string[]) {
    if (!labelIds?.length) return;
    const unique = [...new Set(labelIds)];
    const found = await this.prisma.label.count({ where: { workspaceId, id: { in: unique } } });
    if (found !== unique.length) throw new BadRequestException('One or more labels do not exist in this workspace');
  }

  /** Lets connected clients (Socket.IO) refresh the board without polling. */
  private changed(
    kind: TaskChangedEvent['kind'],
    workspaceId: string,
    projectId: string,
    taskId: string,
    actorId: string,
  ) {
    this.events.emit(Events.TaskChanged, { workspaceId, projectId, taskId, kind, actorId } satisfies TaskChangedEvent);
  }

  private notifyAssigned(
    workspaceId: string,
    task: { id: string; projectId: string; title: string; assigneeId: string | null },
    actorId: string,
  ) {
    if (!task.assigneeId || task.assigneeId === actorId) return;
    this.events.emit(Events.TaskAssigned, {
      workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      actorId,
    } satisfies TaskAssignedEvent);
  }
}
