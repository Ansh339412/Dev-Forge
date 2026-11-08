import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const prisma = { user: { findUnique: jest.fn() }, session: { create: jest.fn() } };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
  const config = { get: (_key: string, fallback?: unknown) => fallback, getOrThrow: jest.fn() };
  const mail = { send: jest.fn() };
  const service = new AuthService(prisma as never, jwt as never, config as never, mail as never);

  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-horse-battery');
  });
  beforeEach(() => jest.clearAllMocks());

  const baseUser = () => ({
    id: 'u1',
    email: 'dev@example.com',
    name: 'Dev',
    avatarUrl: null,
    systemRole: 'USER',
    passwordHash,
    emailVerifiedAt: new Date(),
  });

  it('rejects unknown emails', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@example.com', password: 'whatever-long' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    await expect(
      service.login({ email: 'dev@example.com', password: 'wrong-password-1' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects unverified accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), emailVerifiedAt: null });
    await expect(
      service.login({ email: 'dev@example.com', password: 'correct-horse-battery' }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues tokens and stores only a hash of the refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    const result = await service.login(
      { email: 'dev@example.com', password: 'correct-horse-battery' },
      { ipAddress: '127.0.0.1' },
    );
    expect(result.accessToken).toBe('signed-access-token');
    const stored = prisma.session.create.mock.calls[0][0].data.refreshTokenHash;
    expect(stored).not.toEqual(result.refreshToken);
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
