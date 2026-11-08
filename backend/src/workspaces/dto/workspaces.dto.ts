import { PartialType } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {}

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token: string;
}
