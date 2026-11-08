import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});
