import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { Events, NotificationCreatedEvent } from '../common/events';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  /** If set, a second notify() with the same key for the same user is silently skipped. */
  dedupeKey?: string;
  /** Default true; honours the user's emailNotifications preference. */
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /** Creates the in-app notification, pushes it over Socket.IO (via event) and optionally emails it. */
  async notify(input: NotifyInput) {
    const { email, ...data } = input;
    let notification;
    try {
      notification = await this.prisma.notification.create({ data });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return null; // duplicate dedupeKey
      throw err;
    }
    this.events.emit(Events.NotificationCreated, {
      userId: input.userId,
      notification,
    } satisfies NotificationCreatedEvent);

    if (email !== false) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, emailNotifications: true },
      });
      if (user?.emailNotifications) {
        const link = this.link(input);
        await this.mail.send(
          user.email,
          input.title,
          [input.title, input.body, link && `Open in DevForge: ${link}`].filter(Boolean).join('\n\n'),
        );
      }
    }
    return notification;
  }

  async list(userId: string, unreadOnly: boolean, page: number, limit: number) {
    const where = { userId, readAt: unreadOnly ? null : undefined };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      // Already read is fine; unknown id is not.
      const exists = await this.prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private link(n: NotifyInput): string | undefined {
    if (!n.workspaceId) return undefined;
    const base = `${this.config.getOrThrow<string>('APP_URL')}/w/${n.workspaceId}`;
    if (!n.projectId) return base;
    return `${base}/projects/${n.projectId}${n.taskId ? `?task=${n.taskId}` : ''}`;
  }
}
