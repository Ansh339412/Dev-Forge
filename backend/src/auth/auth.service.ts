import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserTokenType } from '@prisma/client';
import * as argon2 from 'argon2';
import { generateToken, hashToken } from '../common/utils/crypto.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // ---------- registration & email verification ----------

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(dto.password);
    let user: User;
    try {
      user = await this.prisma.user.create({ data: { email, name: dto.name.trim(), passwordHash } });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
    await this.sendVerificationEmail(user);
    return { message: 'Registration successful. Check your email to verify your account.' };
  }

  async verifyEmail(token: string) {
    const userId = await this.consumeUserToken(token, UserTokenType.EMAIL_VERIFICATION);
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return { message: 'Email verified. You can now log in.' };
  }

  /** Always responds the same way so it cannot be used to discover registered emails. */
  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user && !user.emailVerifiedAt) await this.sendVerificationEmail(user);
    return { message: 'If the account exists and is unverified, a new email has been sent.' };
  }

  // ---------- login / sessions ----------

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Please verify your email before logging in');
    }
    return this.issueSession(user, meta);
  }

  /**
   * Rotating refresh tokens. Presenting an already-used token signals theft,
   * so every session of that user is revoked.
   */
  async refresh(refreshToken: string, meta: SessionMeta) {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.expiresAt <= new Date()) throw new UnauthorizedException('Session expired');

    const claimed = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UnauthorizedException('Invalid refresh token');

    return this.issueSession(session.user, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out' };
  }

  listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Session not found');
    return { message: 'Session revoked' };
  }

  // ---------- password reset ----------

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const token = await this.createUserToken(user.id, UserTokenType.PASSWORD_RESET, HOUR_MS);
      const link = `${this.config.getOrThrow('APP_URL')}/reset-password?token=${token}`;
      await this.mail.send(
        user.email,
        'Reset your DevForge password',
        `Hi ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`,
      );
    }
    return { message: 'If the account exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await this.consumeUserToken(token, UserTokenType.PASSWORD_RESET);
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.revokeAllSessions(userId);
    return { message: 'Password updated. Please log in again.' };
  }

  // ---------- internals ----------

  private async issueSession(user: User, meta: SessionMeta) {
    const refreshToken = generateToken(48);
    const ttlDays = Number(this.config.get('REFRESH_TTL_DAYS', 7));
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      },
    });
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.systemRole,
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Number(this.config.get('JWT_ACCESS_TTL_SECONDS', 900)),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        systemRole: user.systemRole,
      },
    };
  }

  private revokeAllSessions(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async sendVerificationEmail(user: User) {
    const token = await this.createUserToken(user.id, UserTokenType.EMAIL_VERIFICATION, DAY_MS);
    const link = `${this.config.getOrThrow('APP_URL')}/verify-email?token=${token}`;
    await this.mail.send(
      user.email,
      'Verify your DevForge email',
      `Hi ${user.name},\n\nConfirm your email address (valid for 24 hours):\n${link}`,
    );
  }

  private async createUserToken(userId: string, type: UserTokenType, ttlMs: number) {
    const token = generateToken();
    await this.prisma.userToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  /** Atomically marks a token used, so it works exactly once. Returns the owning user id. */
  private async consumeUserToken(token: string, type: UserTokenType): Promise<string> {
    const tokenHash = hashToken(token);
    const claimed = await this.prisma.userToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException('Invalid or expired token');
    const record = await this.prisma.userToken.findUniqueOrThrow({ where: { tokenHash } });
    return record.userId;
  }
}
