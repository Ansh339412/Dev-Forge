import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvitationStatus } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Events, InvitationCreatedEvent } from '../common/events';
import { generateToken, hashToken } from '../common/utils/crypto.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/workspaces.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly events: EventEmitter2,
  ) {}

  async create(workspaceId: string, inviter: AuthUser, dto: CreateInvitationDto) {
    const email = dto.email.toLowerCase();

    const alreadyMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, user: { email } },
    });
    if (alreadyMember) throw new ConflictException('User is already a member');

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const token = generateToken();
    const [, invitation] = await this.prisma.$transaction([
      // Re-inviting replaces any earlier pending invite for the same email.
      this.prisma.workspaceInvitation.updateMany({
        where: { workspaceId, email, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.REVOKED },
      }),
      this.prisma.workspaceInvitation.create({
        data: {
          workspaceId,
          email,
          role: dto.role,
          tokenHash: hashToken(token),
          invitedById: inviter.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
        select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
      }),
    ]);

    const link = `${this.config.getOrThrow('APP_URL')}/invitations/accept?token=${token}`;
    await this.mail.send(
      email,
      `${inviter.name} invited you to ${workspace.name} on DevForge`,
      `${inviter.name} invited you to join "${workspace.name}" as ${dto.role}.\n\nAccept (valid 7 days):\n${link}\n\nYou need to sign in with this email address (${email}) to accept.`,
    );
    this.events.emit(Events.InvitationCreated, {
      workspaceId,
      workspaceName: workspace.name,
      inviterId: inviter.id,
      inviterName: inviter.name,
      email,
      role: dto.role,
    } satisfies InvitationCreatedEvent);
    return invitation;
  }

  listPending(workspaceId: string) {
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(workspaceId: string, invitationId: string) {
    const result = await this.prisma.workspaceInvitation.updateMany({
      where: { id: invitationId, workspaceId, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED },
    });
    if (result.count === 0) throw new NotFoundException('Invitation not found');
  }

  async accept(user: AuthUser, token: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    if (invitation.email !== user.email.toLowerCase()) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.workspaceInvitation.updateMany({
        where: { id: invitation.id, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.ACCEPTED },
      });
      if (claimed.count !== 1) throw new BadRequestException('Invalid or expired invitation');

      await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
        update: {},
        create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
      });
      return { workspaceId: invitation.workspaceId, role: invitation.role };
    });
  }
}
