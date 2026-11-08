import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import {
  Events,
  InvitationCreatedEvent,
  ProjectUpdatedEvent,
  TaskAssignedEvent,
  TaskCommentedEvent,
} from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Turns domain events into notifications. Every handler catches its own errors:
 * an unhandled rejection inside an event listener would otherwise crash the process.
 */
@Injectable()
export class NotificationListeners {
  private readonly logger = new Logger(NotificationListeners.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(Events.TaskAssigned)
  onTaskAssigned(e: TaskAssignedEvent) {
    return this.safely('task.assigned', async () => {
      const actor = await this.nameOf(e.actorId);
      await this.notifications.notify({
        userId: e.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        title: `${actor} assigned you "${e.taskTitle}"`,
        workspaceId: e.workspaceId,
        projectId: e.projectId,
        taskId: e.taskId,
      });
    });
  }

  @OnEvent(Events.TaskCommented)
  onTaskCommented(e: TaskCommentedEvent) {
    return this.safely('task.commented', async () => {
      const actor = await this.nameOf(e.actorId);
      for (const userId of e.recipientIds) {
        await this.notifications.notify({
          userId,
          type: NotificationType.TASK_COMMENTED,
          title: `${actor} commented on "${e.taskTitle}"`,
          workspaceId: e.workspaceId,
          projectId: e.projectId,
          taskId: e.taskId,
        });
      }
    });
  }

  @OnEvent(Events.ProjectUpdated)
  onProjectUpdated(e: ProjectUpdatedEvent) {
    return this.safely('project.updated', async () => {
      const [actor, project, members] = await Promise.all([
        this.nameOf(e.actorId),
        this.prisma.project.findUnique({ where: { id: e.projectId }, select: { name: true } }),
        this.prisma.projectMember.findMany({
          where: { projectId: e.projectId, userId: { not: e.actorId } },
          select: { userId: true },
        }),
      ]);
      if (!project) return;
      for (const { userId } of members) {
        await this.notifications.notify({
          userId,
          type: NotificationType.PROJECT_UPDATED,
          title: `${actor} updated project "${project.name}"`,
          body: `Changed: ${e.changes.join(', ')}`,
          workspaceId: e.workspaceId,
          projectId: e.projectId,
        });
      }
    });
  }

  /** Invitation email is already sent by the invitations flow; this adds the in-app entry for existing users. */
  @OnEvent(Events.InvitationCreated)
  onInvitationCreated(e: InvitationCreatedEvent) {
    return this.safely('invitation.created', async () => {
      const invitee = await this.prisma.user.findUnique({ where: { email: e.email }, select: { id: true } });
      if (!invitee) return;
      await this.notifications.notify({
        userId: invitee.id,
        type: NotificationType.WORKSPACE_INVITATION,
        title: `${e.inviterName} invited you to ${e.workspaceName}`,
        body: `Role: ${e.role}. Check your email for the invitation link.`,
        workspaceId: undefined, // not a member yet, so no deep link
        email: false,
      });
    });
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return user?.name ?? 'Someone';
  }

  private async safely(event: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`Notification handler for ${event} failed: ${(err as Error).message}`);
    }
  }
}
