import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/users.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  systemRole: true,
  emailVerifiedAt: true,
  emailNotifications: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name?.trim(), avatarUrl: dto.avatarUrl, emailNotifications: dto.emailNotifications },
      select: PROFILE_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Password changed. Please log in again.' };
  }
}
