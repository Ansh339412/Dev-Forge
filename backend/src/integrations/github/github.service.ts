import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceRole } from '@prisma/client';
import { ActivityService } from '../../activity/activity.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../../projects/projects.service';
import { RedisService } from '../../redis/redis.service';
import { parseRepository } from './github-repo.util';

const API = 'https://api.github.com';
const COMMITS_CACHE_SECONDS = 300;

interface GhRepo {
  full_name: string;
  html_url: string;
  default_branch: string;
}
interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } };
  author?: { login?: string } | null;
}

@Injectable()
export class GithubService {
  private readonly token?: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly redis: RedisService,
  ) {
    // Optional PAT: raises the rate limit from 60/h and allows private repos it can see.
    this.token = config.get<string>('GITHUB_TOKEN') || undefined;
  }

  async connect(
    workspaceId: string,
    projectId: string,
    user: AuthUser,
    role: WorkspaceRole,
    repository: string,
  ) {
    const project = await this.projects.requireProject(workspaceId, projectId);
    this.projects.assertCanManage(project, user, role);

    const parsed = parseRepository(repository);
    if (!parsed) throw new BadRequestException('Use the form "owner/name" or a github.com URL');

    const repo = await this.gh<GhRepo>(
      `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`,
    );
    try {
      const saved = await this.prisma.githubRepository.create({
        data: {
          projectId,
          fullName: repo.full_name,
          htmlUrl: repo.html_url,
          defaultBranch: repo.default_branch,
          connectedById: user.id,
        },
      });
      await this.activity.log({
        workspaceId,
        projectId,
        actorId: user.id,
        action: 'integration.github.connected',
        entityType: 'project',
        entityId: projectId,
        metadata: { repository: repo.full_name },
      });
      return saved;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ConflictException('Repository already connected');
      throw err;
    }
  }

  async list(workspaceId: string, projectId: string) {
    await this.projects.requireProject(workspaceId, projectId);
    return this.prisma.githubRepository.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  async disconnect(workspaceId: string, projectId: string, user: AuthUser, role: WorkspaceRole, repoId: string) {
    const project = await this.projects.requireProject(workspaceId, projectId);
    this.projects.assertCanManage(project, user, role);
    const result = await this.prisma.githubRepository.deleteMany({ where: { id: repoId, projectId } });
    if (result.count === 0) throw new NotFoundException('Repository not found');
  }

  /** Recent commits, cached in Redis so dashboards do not burn the GitHub rate limit. */
  async commits(workspaceId: string, projectId: string, repoId: string, limit: number) {
    await this.projects.requireProject(workspaceId, projectId);
    const repo = await this.prisma.githubRepository.findFirst({ where: { id: repoId, projectId } });
    if (!repo) throw new NotFoundException('Repository not found');

    const cacheKey = `gh:commits:${repo.id}:${limit}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);

    // fullName was validated before it was stored, so it is safe to place in the path.
    const raw = await this.gh<GhCommit[]>(`/repos/${repo.fullName}/commits?per_page=${limit}`);
    const commits = raw.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0].slice(0, 200),
      author: c.commit.author?.name ?? null,
      authorLogin: c.author?.login ?? null,
      date: c.commit.author?.date ?? null,
      url: c.html_url,
    }));
    const result = { repository: repo.fullName, commits };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', COMMITS_CACHE_SECONDS).catch(() => undefined);
    return result;
  }

  private async gh<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'devforge',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('GitHub is unreachable right now');
    }
    if (res.status === 404) throw new NotFoundException('Repository not found or not accessible');
    if (res.status === 403 || res.status === 429) {
      throw new ServiceUnavailableException('GitHub rate limit reached; try again later');
    }
    if (!res.ok) throw new BadGatewayException(`GitHub responded with HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
