import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hourly: remind assignees of open tasks due within 24h. Safe to run on several
 * replicas at once because the dedupeKey (task + due date) is unique per user.
 */
@Injectable()
export class DueSoonScheduler {
  private readonly logger = new Logger(DueSoonScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    try {
      const now = new Date();
      const tasks = await this.prisma.task.findMany({
        where: {
          status: { not: TaskStatus.COMPLETED },
          assigneeId: { not: null },
          dueDate: { gt: now, lte: new Date(now.getTime() + DAY_MS) },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          assigneeId: true,
          projectId: true,
          project: { select: { workspaceId: true } },
        },
        take: 500, // bounded per run; the next hourly run picks up the rest
      });
      for (const t of tasks) {
        await this.notifications.notify({
          userId: t.assigneeId!,
          type: NotificationType.TASK_DUE_SOON,
          title: `"${t.title}" is due within 24 hours`,
          workspaceId: t.project.workspaceId,
          projectId: t.projectId,
          taskId: t.id,
          dedupeKey: `due:${t.id}:${t.dueDate!.toISOString().slice(0, 10)}`,
        });
      }
      if (tasks.length) this.logger.log(`Checked ${tasks.length} tasks due within 24h`);
    } catch (err) {
      this.logger.error(`Due-soon run failed: ${(err as Error).message}`);
    }
  }
}
