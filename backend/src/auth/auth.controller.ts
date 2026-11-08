import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService, SessionMeta } from './auth.service';
import {
  EmailDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/auth.dto';

// Stricter than the global limit: these endpoints are brute-force / abuse targets.
const STRICT = { default: { limit: 5, ttl: 60_000 } };

const metaFrom = (req: Request): SessionMeta => ({
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('resend-verification')
  resendVerification(@Body() dto: EmailDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, metaFrom(req));
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, metaFrom(req));
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.revokeSession(user.id, id);
  }
}
