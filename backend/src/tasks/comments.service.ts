import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkspaceRole } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Events, TaskCommentedEvent } from '../common/events';
import { USER_BRIEF } from '../common/utils/selects';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  async list(workspaceId: string, projectId: string, taskId: string) {
    await this.requireTask(workspaceId, projectId, taskId);
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: USER_BRIEF } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: AuthUser,
    role: WorkspaceRole,
    body: string,
  ) {
    const task = await this.requireTask(workspaceId, projectId, taskId);
    const project = await this.projects.requireProject(workspaceId, projectId);
    await this.projects.assertCanWork(project, user, role);

    const comment = await this.prisma.comment.create({
      data: { taskId, authorId: user.id, body: body.trim() },
      include: { author: { select: USER_BRIEF } },
    });
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'comment.created',
      entityType: 'comment',
      entityId: comment.id,
      metadata: { taskId, taskTitle: task.title },
    });

    const recipientIds = [...new Set([task.assigneeId, task.createdById])].filter(
      (id): id is string => !!id && id !== user.id,
    );
    if (recipientIds.length) {
      this.events.emit(Events.TaskCommented, {
        workspaceId,
        projectId,
        taskId,
        taskTitle: task.title,
        actorId: user.id,
        recipientIds,
      } satisfies TaskCommentedEvent);
    }
    return comment;
  }

  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    user: AuthUser,
    body: string,
  ) {
    const comment = await this.requireComment(workspaceId, projectId, taskId, commentId);
    if (comment.authorId !== user.id) throw new ForbiddenException('You can only edit your own comments');
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: body.trim() },
      include: { author: { select: USER_BRIEF } },
    });
  }

  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    user: AuthUser,
    role: WorkspaceRole,
  ) {
    const comment = await this.requireComment(workspaceId, projectId, taskId, commentId);
    if (comment.authorId !== user.id && role !== WorkspaceRole.WORKSPACE_ADMIN) {
      throw new ForbiddenException('Only the author or a workspace admin can delete this comment');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  private async requireTask(workspaceId: string, projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, project: { workspaceId } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async requireComment(workspaceId: string, projectId: string, taskId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId, task: { projectId, project: { workspaceId } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}
