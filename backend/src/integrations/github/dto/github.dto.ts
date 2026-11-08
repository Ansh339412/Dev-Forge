import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ConnectRepositoryDto {
  /** "owner/name" or a github.com URL. */
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  repository: string;
}

export class ListCommitsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
