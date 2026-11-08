import { Injectable } from '@nestjs/common';
import { ProjectStatus, TaskStatus } from '@prisma/client';
import { USER_BRIEF } from '../common/utils/selects';
import { PrismaService } from '../prisma/prisma.service';
import { buildDailySeries, DayCount, windowStart } from './analytics.util';

type Row = { day: Date; count: number };
const toDayCounts = (rows: Row[]): DayCount[] => rows.map((r) => ({ day: r.day, count: Number(r.count) }));

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything the dashboard needs, computed from live rows (nothing cached or mocked). */
  async dashboard(workspaceId: string, days: number) {
    const now = new Date();
    const since = windowStart(now, days);
    const inWorkspace = { project: { workspaceId } };
    const open = { status: { not: TaskStatus.COMPLETED } };

    const [
      totalProjects,
      activeProjects,
      completedTasks,
      pendingTasks,
      overdueTasks,
      projects,
      statusRows,
      completedByUser,
      openByUser,
      createdRows,
      completedRows,
    ] = await Promise.all([
      this.prisma.project.count({ where: { workspaceId } }),
      this.prisma.project.count({ where: { workspaceId, status: ProjectStatus.ACTIVE } }),
      this.prisma.task.count({ where: { ...inWorkspace, status: TaskStatus.COMPLETED } }),
      this.prisma.task.count({ where: { ...inWorkspace, ...open } }),
      this.prisma.task.count({ where: { ...inWorkspace, ...open, dueDate: { lt: now } } }),
      this.prisma.project.findMany({
        where: { workspaceId, status: { not: ProjectStatus.ARCHIVED } },
        select: { id: true, name: true, status: true, deadline: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.task.groupBy({
        by: ['projectId', 'status'],
        where: inWorkspace,
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { ...inWorkspace, status: TaskStatus.COMPLETED, completedAt: { gte: since }, assigneeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { ...inWorkspace, ...open, assigneeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Row[]>`
        SELECT date_trunc('day', t."createdAt") AS day, COUNT(*)::int AS count
        FROM tasks t JOIN projects p ON p.id = t."projectId"
        WHERE p."workspaceId" = ${workspaceId} AND t."createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Row[]>`
        SELECT date_trunc('day', t."completedAt") AS day, COUNT(*)::int AS count
        FROM tasks t JOIN projects p ON p.id = t."projectId"
        WHERE p."workspaceId" = ${workspaceId} AND t."completedAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
    ]);

    // Per-project completion %
    const perProject = new Map<string, { total: number; done: number }>();
    for (const r of statusRows) {
      const e = perProject.get(r.projectId) ?? { total: 0, done: 0 };
      e.total += r._count._all;
      if (r.status === TaskStatus.COMPLETED) e.done += r._count._all;
      perProject.set(r.projectId, e);
    }
    const projectCompletion = projects.map((p) => {
      const { total = 0, done = 0 } = perProject.get(p.id) ?? {};
      return { ...p, totalTasks: total, completedTasks: done, completionPercent: total ? Math.round((done / total) * 100) : 0 };
    });

    // Team productivity
    const completedMap = new Map(completedByUser.map((r) => [r.assigneeId!, r._count._all]));
    const openMap = new Map(openByUser.map((r) => [r.assigneeId!, r._count._all]));
    const userIds = [...new Set([...completedMap.keys(), ...openMap.keys()])];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: USER_BRIEF })
      : [];
    const productivity = users
      .map((user) => ({
        user,
        completedInWindow: completedMap.get(user.id) ?? 0,
        openTasks: openMap.get(user.id) ?? 0,
      }))
      .sort((a, b) => b.completedInWindow - a.completedInWindow);

    return {
      totals: { totalProjects, activeProjects, completedTasks, pendingTasks, overdueTasks },
      projectCompletion,
      productivity: { windowDays: days, members: productivity },
      activity: buildDailySeries(now, days, toDayCounts(createdRows), toDayCounts(completedRows)),
    };
  }

  /** The caller's open tasks in this workspace, soonest due first. */
  myTasks(workspaceId: string, userId: string) {
    return this.prisma.task.findMany({
      where: { assigneeId: userId, status: { not: TaskStatus.COMPLETED }, project: { workspaceId } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      take: 50,
    });
  }
}
