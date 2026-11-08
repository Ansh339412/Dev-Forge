import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWorkspaceDto } from './dto/workspaces.dto';
import { WorkspacesService } from './workspaces.service';

/** Routes that are not scoped to a single workspace. */
@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }
}
