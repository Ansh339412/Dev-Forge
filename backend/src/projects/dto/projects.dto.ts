import { PartialType } from '@nestjs/swagger';
import { Priority, ProjectStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** ISO 8601 date. Send null on update to clear. */
  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  /** Defaults to the creator. Must be a workspace Project Manager or Admin. */
  @IsOptional()
  @IsUUID()
  managerId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class AddProjectMemberDto {
  @IsUUID()
  userId: string;
}

export class ListProjectsQuery {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}

export class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}
