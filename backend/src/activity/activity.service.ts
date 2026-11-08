import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { USER_BRIEF } from '../common/utils/selects';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityEntry {
  workspaceId: string;
  projectId?: string;
  actorId: string;
  action: string; // e.g. "task.created"
  entityType: 'project' | 'task' | 'comment' | 'member';
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: ActivityEntry) {
    return this.prisma.activityLog.create({ data: entry });
  }

  async listForProject(projectId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where: { projectId },
        include: { actor: { select: USER_BRIEF } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where: { projectId } }),
    ]);
    return { items, total, page, limit };
  }
}
