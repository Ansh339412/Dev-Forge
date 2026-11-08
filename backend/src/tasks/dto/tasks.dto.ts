import { OmitType, PartialType } from '@nestjs/swagger';
import { Priority, TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** ISO 8601. Send null on update to clear. */
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  /** Must be a project member. Send null on update to unassign. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  labelIds?: string[];
}

/** Status changes go through POST :taskId/move so ordering stays consistent. */
export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['status'] as const)) {}

export class MoveTaskDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  /** Drop the card directly below this task. Omit/null = top of the column. */
  @IsOptional()
  @IsUUID()
  afterTaskId?: string | null;
}

export class ListTasksQuery {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}

export class CreateLabelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex value like #3b82f6' })
  color: string;
}
