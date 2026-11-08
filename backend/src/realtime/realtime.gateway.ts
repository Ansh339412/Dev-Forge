import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SystemRole } from '@prisma/client';
import { Namespace, Socket } from 'socket.io';
import { Events, NotificationCreatedEvent, TaskChangedEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SocketUser {
  id: string;
  systemRole: SystemRole;
}

/**
 * Namespace /realtime. Clients connect with { auth: { token: <access JWT> } }.
 *  - every user is placed in room user:<id> and receives "notification" events
 *  - "project.join" {projectId} subscribes to "task.changed" events for that project
 * Note: tokens are verified at connect time only; clients should reconnect after refreshing.
 * Scaling beyond one backend replica needs the Socket.IO Redis adapter.
 */
@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() private server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Authenticate before the connection is established, so no events can race the auth. */
  afterInit(server: Namespace) {
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string') throw new Error('missing token');
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, systemRole: true },
        });
        if (!user) throw new Error('unknown user');
        socket.data.user = user satisfies SocketUser;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(client: Socket) {
    const user = client.data.user as SocketUser;
    void client.join(`user:${user.id}`);
    this.logger.debug(`socket connected for user ${user.id}`);
  }

  @SubscribeMessage('project.join')
  async joinProject(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: unknown }) {
    const user = client.data.user as SocketUser;
    const projectId = body?.projectId;
    if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) return { ok: false };

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return { ok: false };
    if (user.systemRole !== SystemRole.SUPER_ADMIN) {
      const member = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: user.id } },
      });
      if (!member) return { ok: false };
    }
    await client.join(`project:${projectId}`);
    return { ok: true };
  }

  @SubscribeMessage('project.leave')
  async leaveProject(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: unknown }) {
    if (typeof body?.projectId === 'string') await client.leave(`project:${body.projectId}`);
    return { ok: true };
  }

  @OnEvent(Events.NotificationCreated)
  onNotification(e: NotificationCreatedEvent) {
    this.server.to(`user:${e.userId}`).emit('notification', e.notification);
  }

  @OnEvent(Events.TaskChanged)
  onTaskChanged(e: TaskChangedEvent) {
    this.server.to(`project:${e.projectId}`).emit('task.changed', e);
  }
}
