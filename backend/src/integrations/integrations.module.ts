import { Module } from '@nestjs/common';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { ProjectsModule } from '../projects/projects.module';
import { GithubController } from './github/github.controller';
import { GithubService } from './github/github.service';

@Module({
  imports: [ProjectsModule],
  controllers: [GithubController],
  providers: [GithubService, WorkspaceRolesGuard],
})
export class IntegrationsModule {}
